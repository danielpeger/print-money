import { randomUUID } from 'node:crypto';
import { createAlpaca } from './alpaca.js';
import { normalizeBars } from './bars.js';
import { classifyNow, nextTradingDay } from './calendar.js';
import { BASKET, MIN_NOTIONAL } from './config.js';
import { shiftYears } from './dates.js';
import {
  adoptBrokerHoldings,
  applyFilledBuy,
  applyFilledSell,
  brokerClass,
  recordedIntentStatus,
  RECONCILE_INTENT_STATUSES,
  unexpectedMessage,
} from './holdings.js';
import { log } from './log.js';
import { sendRunSummary } from './mail.js';
import { clientOrderId, submitIntents } from './orders.js';
import { planBook } from './plan-book.js';
import { assertPaperEnv, checkAccount, checkDataFresh, checkExposure, exposureMessage, killSwitchOn } from './risk.js';
import { buildSignalMaps, priorSignalsForDate, signalsForDate } from './simulate.js';
import { spreadCost } from './spread.js';
import { createStore } from './store.js';

const BOOK_ORDER = ['trend', 'dip', 'control'];

function round6(value) {
  return Math.round(value * 1e6) / 1e6;
}

async function notifyWebhook(env, payload) {
  if (!env.ALERT_WEBHOOK_URL) return;
  try {
    await fetch(env.ALERT_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    log('error', { message: 'alert_webhook_failed', runId: payload.runId });
  }
}

function alpacaBody(order) {
  const body = {
    symbol: order.symbol,
    side: order.side,
    type: 'market',
    time_in_force: 'day',
    client_order_id: order.clientOrderId,
  };
  if (order.side === 'buy') body.notional = Number(order.notional).toFixed(2);
  else body.qty = String(order.qty);
  return body;
}

export async function executeRun({ dryRun = false, now = new Date(), env = process.env } = {}) {
  assertPaperEnv(env);
  const dry = dryRun || env.DRY_RUN === 'true';
  const clock = classifyNow(now);
  const runId = `${(clock.sessionDate || clock.nyDate).replaceAll('-', '')}-${randomUUID().slice(0, 8)}`;
  const store = createStore(env);
  log('info', { runId, message: 'wake', reason: clock.reason, sessionDate: clock.sessionDate, dryRun: dry });

  if (clock.action !== 'run') {
    await store.startRun({
      run_id: runId,
      session_date: clock.sessionDate,
      status: 'skipped_data_not_ready',
      dry_run: dry,
      detail: { reason: clock.reason },
      finished_at: new Date().toISOString(),
    });
    return mailed(env, {
      ok: true,
      runId,
      status: 'skipped_data_not_ready',
      reason: clock.reason,
      sessionDate: clock.sessionDate,
      nyDate: clock.nyDate,
      dryRun: dry,
    });
  }

  const sessionDate = clock.sessionDate;
  const locked = await store.acquireLock(sessionDate, runId);
  if (!locked) {
    return mailed(env, {
      ok: true,
      runId,
      status: 'skipped_concurrent',
      reason: 'skipped_concurrent',
      sessionDate,
      nyDate: clock.nyDate,
      dryRun: dry,
    });
  }

  try {
    await store.startRun({
      run_id: runId,
      session_date: sessionDate,
      status: 'started',
      dry_run: dry,
      detail: {},
    });
    const summary = await tradeSession({ env, store, runId, sessionDate, dryRun: dry });
    await store.finishRun(runId, {
      status: summary.status,
      detail: { ...summary.detail, reason: clock.reason },
      error: summary.error || null,
      finished_at: new Date().toISOString(),
    });
    if (summary.status === 'failed') {
      await notifyWebhook(env, { runId, sessionDate, kind: 'failed', message: summary.error || summary.status });
    }
    return mailed(env, {
      ok: summary.status !== 'failed',
      runId,
      status: summary.status,
      reason: clock.reason,
      sessionDate,
      nyDate: clock.nyDate,
      executionDate: summary.executionDate,
      dryRun: dry,
      books: summary.books,
      error: summary.error || null,
      detail: { ...summary.detail, reason: clock.reason },
    });
  } catch (error) {
    const message = error.message || 'run_failed';
    log('error', { runId, sessionDate, message });
    try {
      await store.alert({ run_id: runId, session_date: sessionDate, kind: 'failed', message });
      await store.finishRun(runId, { status: 'failed', error: message, finished_at: new Date().toISOString() });
    } catch {
      log('error', { runId, message: 'failed_to_record_failure' });
    }
    await notifyWebhook(env, { runId, sessionDate, kind: 'failed', message });
    return mailed(env, {
      ok: false,
      runId,
      status: 'failed',
      reason: clock.reason,
      sessionDate,
      nyDate: clock.nyDate,
      dryRun: dry,
      error: message,
    });
  } finally {
    try {
      await store.releaseLock(sessionDate, runId);
    } catch {
      log('error', { runId, message: 'lock_release_failed' });
    }
  }
}

async function mailed(env, result) {
  await sendRunSummary(result, env);
  return result;
}

async function tradeSession({ env, store, runId, sessionDate, dryRun }) {
  const executionDate = nextTradingDay(sessionDate);
  const strategies = await store.strategies();
  for (const code of BOOK_ORDER) {
    if (!strategies.get(code)) throw new Error(`missing book row: ${code}`);
  }
  const controls = await store.controls();
  if (!controls) throw new Error('kill switch could not be read');
  const killed = killSwitchOn(env, controls);

  const data = createAlpaca({
    key: env.APCA_API_KEY_ID_TREND,
    secret: env.APCA_API_SECRET_KEY_TREND,
    env,
  });
  const barMap = await data.bars(BASKET, shiftYears(sessionDate, -3), new Date(Date.now() - 20 * 60 * 1000).toISOString());
  const bars = {};
  for (const symbol of BASKET) bars[symbol] = normalizeBars([...(barMap.get(symbol) || [])]).bars;
  const sessions = (bars.AAPL || []).map((bar) => bar.date);
  const fresh = checkDataFresh(sessions.at(-1), sessionDate);
  if (!fresh.ok) {
    await store.alert({ run_id: runId, session_date: sessionDate, kind: 'stale_bars', message: `latest bar ${fresh.latestBarDate || 'none'}` });
    return {
      status: 'skipped_data_not_ready',
      executionDate,
      detail: { reason: 'stale_bars', latest: fresh.latestBarDate || null },
      books: {},
    };
  }

  const quoteMap = await data.openingQuotes(BASKET, sessionDate).catch((error) => {
    log('error', { runId, message: 'quotes_unavailable', detail: error.message });
    return new Map();
  });
  const quoteRows = [];
  const quoteGaps = [];
  for (const symbol of BASKET) {
    const quote = quoteMap.get(symbol);
    if (!quote) {
      quoteGaps.push(symbol);
      continue;
    }
    quoteRows.push({
      session_date: sessionDate,
      symbol,
      quote_at: quote.quote_at,
      bid: quote.bid,
      ask: quote.ask,
      bid_size: quote.bid_size,
      ask_size: quote.ask_size,
      feed: 'sip',
    });
  }
  const savedQuotes = dryRun ? [] : await store.upsertQuotes(quoteRows);
  const quoteIds = new Map(savedQuotes.map((row) => [row.symbol, row.id]));

  const accounts = {};
  for (const code of BOOK_ORDER) {
    const client = createAlpaca({
      key: env[`APCA_API_KEY_ID_${code.toUpperCase()}`],
      secret: env[`APCA_API_SECRET_KEY_${code.toUpperCase()}`],
      env,
    });
    const [account, positions, openOrders] = await Promise.all([client.account(), client.positions(), client.openOrders()]);
    const view = {
      equity: Number(account.equity),
      cash: Number(account.cash),
      status: account.status,
      positions,
      openOrders,
    };
    if (!checkAccount(view).ok || account.status !== 'ACTIVE') throw new Error(`account unavailable: ${code}`);
    if (positions.some((position) => position.side && position.side !== 'long')) throw new Error(`short position on ${code}`);
    accounts[code] = { client, ...view };
  }

  const signalMaps = buildSignalMaps(bars);
  const signals = signalsForDate(signalMaps, sessionDate);
  const priorSignals = priorSignalsForDate(signalMaps, sessions, sessionDate);
  const assets = new Map();
  for (const symbol of BASKET) assets.set(symbol, await data.asset(symbol));
  const eligible = (symbol) => {
    const asset = assets.get(symbol);
    return Boolean(asset && asset.tradable && asset.fractionable && asset.status === 'active' && signals.has(symbol));
  };

  let uncertain = false;
  const unexpectedBooks = [];
  const adoptedBooks = [];
  const fillsByBook = { trend: [], dip: [], control: [] };
  if (!dryRun) {
    for (const code of BOOK_ORDER) {
      const strategyId = strategies.get(code).id;
      const result = await reconcileBook({
        store,
        code,
        strategyId,
        client: accounts[code].client,
        positions: accounts[code].positions,
        quoteIds,
        quoteMap,
        sessionDate,
        runId,
      });
      fillsByBook[code] = result.fills || [];
      if (result.uncertain) uncertain = true;
      if (result.adopted.length > 0) adoptedBooks.push({ book: code, adopted: result.adopted });
      if (result.unexpected.length > 0) unexpectedBooks.push({ book: code, symbols: result.unexpected });
    }
  }
  if (uncertain) {
    return {
      status: 'failed',
      error: 'uncertain order',
      executionDate,
      detail: { quoteGaps, adopted: adoptedBooks, fills: fillsByBook },
      books: {},
    };
  }
  if (unexpectedBooks.length > 0) {
    const message = unexpectedBooks.map((row) => unexpectedMessage(row.book, row.symbols)).join('; ');
    return {
      status: 'failed',
      error: message,
      executionDate,
      detail: { quoteGaps, unexpected: unexpectedBooks, adopted: adoptedBooks, fills: fillsByBook },
      books: {},
    };
  }

  const plans = {};
  for (const code of BOOK_ORDER) {
    const strategyId = strategies.get(code).id;
    const state = await store.bookState(strategyId);
    const account = accounts[code];
    plans[code] = planBook({
      code,
      state,
      account,
      signals,
      priorSignals,
      sessions,
      sessionDate,
      executionDate,
      eligible,
    });
    if (!plans[code].ok) {
      const symbols = plans[code].symbols || (plans[code].symbol ? [plans[code].symbol] : []);
      const message = `${plans[code].blocked || 'plan_failed'} ${symbols.join(',')} (${code})`.trim();
      await store.alert({
        run_id: runId,
        session_date: sessionDate,
        kind: plans[code].blocked || 'plan_failed',
        message,
      });
      return {
        status: 'failed',
        error: message,
        executionDate,
        detail: { quoteGaps, blocked: plans[code].blocked, symbols, book: code, adopted: adoptedBooks, fills: fillsByBook },
        books: {},
      };
    }
  }

  const books = {};
  const ready = [];
  for (const code of BOOK_ORDER) {
    const plan = plans[code];
    const account = accounts[code];
    const orders = plan.orders.filter((order) => {
      if (order.side === 'buy' && !(order.notional >= MIN_NOTIONAL)) {
        plan.skipped.push({ symbol: order.symbol, side: 'buy', reason: 'below_min_notional' });
        return false;
      }
      return true;
    });
    const positionValue = account.positions.reduce((sum, position) => sum + Number(position.market_value || 0), 0);
    const buyNotional = orders.filter((order) => order.side === 'buy').reduce((sum, order) => sum + Number(order.notional || 0), 0);
    const sellNotional = orders.filter((order) => order.side === 'sell').reduce((sum, order) => sum + Number(order.estimatedProceeds || 0), 0);
    const exposure = checkExposure({ equity: account.equity, positionValue, buyNotional, sellNotional });
    if (!exposure.ok) {
      const message = exposureMessage(code, exposure);
      await store.alert({ run_id: runId, session_date: sessionDate, kind: 'exposure', message });
      return {
        status: 'failed',
        error: message,
        executionDate,
        detail: { quoteGaps, blocked: 'exposure', book: code, adopted: adoptedBooks, fills: fillsByBook },
        books: {},
      };
    }
    ready.push({ code, plan, account, orders });
  }

  let submittedAny = false;
  for (const { code, plan, account, orders } of ready) {
    for (const order of orders) {
      order.clientOrderId = clientOrderId({
        book: code,
        executionDate,
        symbol: order.symbol,
        side: order.side,
      });
    }

    const publicOrders = orders.map((order) => ({
      symbol: order.symbol,
      side: order.side,
      notional: order.notional ?? null,
      qty: order.qty ?? null,
      reason: order.reason,
    }));
    books[code] = {
      equity: account.equity,
      deployable: plan.capital,
      opening: plan.opening,
      orders: publicOrders,
      skipped: plan.skipped,
      target: plan.target || [],
      cooldown: plan.cooldown || [],
      waiting: plan.waiting || [],
      fills: fillsByBook[code] || [],
      submission: [],
    };

    if (!dryRun) {
      const strategyId = strategies.get(code).id;
      await store.saveSignals({
        strategy_id: strategyId,
        session_date: sessionDate,
        run_id: runId,
        signals: {
          target: plan.target || [],
          orders: publicOrders,
          skipped: plan.skipped,
          waiting: plan.waiting || [],
        },
      });
      for (const order of orders) {
        await store.upsertReason({
          strategy_id: strategyId,
          session_date: executionDate,
          symbol: order.symbol,
          side: order.side,
          client_order_id: order.clientOrderId,
          reason: order.reason,
        });
        await store.upsertIntent({
          strategy_id: strategyId,
          run_id: runId,
          session_date: executionDate,
          symbol: order.symbol,
          side: order.side,
          client_order_id: order.clientOrderId,
          notional: order.side === 'buy' ? order.notional : null,
          qty: order.side === 'sell' ? Number(order.qty) : null,
          reason: order.reason,
          slot_kind: order.slotKind,
          fallback_rank: order.fallbackRank ?? null,
          opening: Boolean(order.opening),
          status: killed ? 'blocked' : 'pending',
        });
      }
      if (!killed && orders.length > 0) {
        const results = await submitIntents(orders, {
          findByClientOrderId: (id) => account.client.findByClientOrderId(id),
          submit: (intent) => account.client.submit(alpacaBody(intent)),
        });
        submittedAny = true;
        books[code].submission = results.map((result) => ({
          symbol: result.symbol,
          side: result.side,
          status: recordedIntentStatus(result.status),
          error: result.error || null,
        }));
        for (const result of results) {
          await store.upsertIntent({
            strategy_id: strategyId,
            run_id: runId,
            session_date: executionDate,
            symbol: result.symbol,
            side: result.side,
            client_order_id: result.clientOrderId,
            notional: result.side === 'buy' ? result.notional : null,
            qty: result.side === 'sell' ? Number(result.qty) : null,
            reason: result.reason,
            slot_kind: result.slotKind,
            fallback_rank: result.fallbackRank ?? null,
            opening: Boolean(result.opening),
            status: recordedIntentStatus(result.status),
            broker_order_id: result.brokerOrderId || null,
            error: result.error || null,
          });
          if (result.status === 'uncertain') uncertain = true;
        }
      }
      const state = await store.bookState(strategyId);
      const nextPositions = Array.isArray(state.positions) ? [...state.positions] : [];
      for (const row of plan.target || []) {
        const existing = nextPositions.find((position) => position.symbol === row.symbol);
        if (!existing) continue;
        existing.slotKind = row.slotKind;
        existing.dipEntrySession = row.dipEntrySession ?? null;
        existing.fallbackRank = row.fallbackRank ?? null;
      }
      await store.saveBookState(strategyId, {
        positions: nextPositions,
        cooldown: plan.cooldown || state.cooldown || [],
        opened: Boolean(state.opened || (plan.opening && !killed && orders.length > 0)),
      });
    }
    if (uncertain) break;
  }

  if (uncertain) {
    return {
      status: 'failed',
      error: 'uncertain order',
      executionDate,
      detail: { quoteGaps, killSwitch: killed, adopted: adoptedBooks, fills: fillsByBook },
      books,
    };
  }
  return {
    status: submittedAny ? 'orders_submitted' : 'reconciled',
    executionDate,
    detail: { quoteGaps, killSwitch: killed, dryRun, adopted: adoptedBooks, fills: fillsByBook },
    books,
  };
}

async function quoteForFill(store, intent, quoteIds, quoteMap, sessionDate, quoteCache) {
  if (intent.session_date === sessionDate) {
    const quote = quoteMap.get(intent.symbol);
    const quoteId = quoteIds.get(intent.symbol);
    return { quote, quoteId };
  }
  if (!quoteCache.has(intent.session_date)) {
    quoteCache.set(intent.session_date, await store.quotesForSession(intent.session_date));
  }
  const row = (quoteCache.get(intent.session_date) || []).find((item) => item.symbol === intent.symbol);
  if (!row) return { quote: null, quoteId: null };
  return { quote: { bid: Number(row.bid), ask: Number(row.ask) }, quoteId: row.id };
}

async function reconcileBook({ store, code, strategyId, client, positions, quoteIds, quoteMap, sessionDate, runId }) {
  const intents = await store.intents(strategyId);
  const state = await store.bookState(strategyId);
  let uncertain = false;
  const fills = [];
  const quoteCache = new Map();
  for (const intent of intents) {
    if (!RECONCILE_INTENT_STATUSES.includes(intent.status)) continue;
    if (intent.session_date > sessionDate) continue;
    const broker = await client.findByClientOrderId(intent.client_order_id);
    if (!broker) {
      if (intent.status === 'pending' || intent.status === 'blocked') continue;
      uncertain = true;
      await store.alert({
        run_id: runId,
        session_date: sessionDate,
        kind: 'uncertain_order',
        message: `${intent.client_order_id} was not at the broker`,
      });
      continue;
    }
    const klass = brokerClass(broker);
    await store.upsertIntent({
      ...intentRow(intent, strategyId),
      status: broker.status,
      broker_order_id: broker.id,
      filled_qty: broker.filled_qty,
      filled_avg_price: broker.filled_avg_price,
      error: null,
    });
    if (klass === 'partial' || klass === 'uncertain' || (klass === 'open' && intent.session_date <= sessionDate)) {
      uncertain = true;
      await store.alert({
        run_id: runId,
        session_date: sessionDate,
        kind: 'uncertain_order',
        message: `${intent.client_order_id} is ${broker.status}`,
      });
      continue;
    }
    if (klass !== 'filled') continue;
    const shares = Number(broker.filled_qty);
    const fillPrice = Number(broker.filled_avg_price);
    const fill = {
      symbol: intent.symbol,
      side: intent.side,
      shares,
      fillPrice,
      spreadCost: null,
      reason: intent.reason,
    };
    const { quote, quoteId } = await quoteForFill(store, intent, quoteIds, quoteMap, sessionDate, quoteCache);
    if (quote && quoteId && shares > 0 && fillPrice > 0) {
      const cost = spreadCost({ side: intent.side, shares, fillPrice, bid: quote.bid, ask: quote.ask });
      if (cost != null) {
        fill.spreadCost = round6(cost);
        await store.upsertFillCost({
          strategy_id: strategyId,
          opening_quote_id: quoteId,
          session_date: intent.session_date,
          symbol: intent.symbol,
          side: intent.side,
          client_order_id: intent.client_order_id,
          shares,
          fill_price: fillPrice,
          fill_at: broker.filled_at || new Date().toISOString(),
          spread_cost_usd: round6(cost),
        });
      }
    }
    fills.push(fill);
    if (intent.side === 'buy') applyFilledBuy(state, intent, code);
    else applyFilledSell(state, intent);
  }
  const adoption = adoptBrokerHoldings({
    brokerPositions: positions,
    state,
    intents,
    code,
  });
  await store.saveBookState(strategyId, {
    positions: state.positions || [],
    cooldown: state.cooldown || [],
    opened: Boolean(state.opened),
  });
  if (adoption.adopted.length > 0) {
    log('info', {
      runId,
      message: 'adopted_positions',
      book: code,
      symbols: adoption.adopted.map((row) => row.symbol),
    });
  }
  if (adoption.unexpected.length > 0) {
    await store.alert({
      run_id: runId,
      session_date: sessionDate,
      kind: 'unexpected_position',
      message: unexpectedMessage(code, adoption.unexpected),
    });
  }
  return { uncertain, unexpected: adoption.unexpected, adopted: adoption.adopted, fills };
}

function intentRow(intent, strategyId) {
  return {
    strategy_id: strategyId,
    run_id: intent.run_id,
    session_date: intent.session_date,
    symbol: intent.symbol,
    side: intent.side,
    client_order_id: intent.client_order_id,
    notional: intent.notional,
    qty: intent.qty,
    reason: intent.reason,
    slot_kind: intent.slot_kind,
    fallback_rank: intent.fallback_rank,
    opening: intent.opening,
  };
}
