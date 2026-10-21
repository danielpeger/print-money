import { BASKET, BOOK_CAPITAL, BOOKS, COST_RATE, FALLBACK, MIN_NOTIONAL, START_SESSION } from './config.js';
import { floorCents } from './dates.js';
import { unexpectedSymbols } from './holdings.js';
import { inferredCash } from './risk.js';
import { planActiveBook, planControl, resolveExecution } from './slots.js';

export function planBook({ code, state, account, signals, priorSignals = null, sessions, sessionDate, executionDate, eligible }) {
  const missing = unexpectedSymbols(account.positions, state.positions);
  if (missing.length > 0) {
    return { ok: false, blocked: 'unexpected_position', symbol: missing[0], symbols: missing };
  }
  const holdings = [];
  for (const position of account.positions) {
    const meta = (state.positions || []).find((row) => row.symbol === position.symbol);
    holdings.push({
      symbol: position.symbol,
      slotKind: meta.slotKind,
      entrySession: meta.entrySession,
      dipEntrySession: meta.dipEntrySession ?? null,
      fallbackRank: meta.fallbackRank ?? null,
      qty: position.qty,
    });
  }
  const opening = holdings.length === 0 && account.openOrders.length === 0 && !state.opened;
  const capital = Math.min(account.equity, BOOK_CAPITAL);
  if (state.opened && holdings.length === 0 && account.openOrders.length > 0) {
    return {
      ok: true,
      orders: [],
      skipped: [{ symbol: null, side: null, reason: 'opening_in_flight' }],
      target: [],
      cooldown: state.cooldown || [],
      waiting: [],
      opening: false,
      capital,
    };
  }
  if (code === 'control') {
    const planned = planControl({ basket: BASKET, opening, capital });
    const skipped = [];
    const orders = [];
    for (const order of planned.orders) {
      order.executionDate = executionDate;
      if (!eligible(order.symbol)) {
        skipped.push({ symbol: order.symbol, side: 'buy', reason: 'not_eligible' });
        continue;
      }
      if (executionDate !== START_SESSION) {
        order.reason = `Buy ${order.symbol} to open Control on ${executionDate}. The start session was missed. Control buys the basket in equal dollars and does not trade again.`;
      }
      orders.push(order);
    }
    const capped = capBuysToCash(orders.filter((order) => order.side === 'buy'), inferredCash(account), 0);
    return {
      ok: true,
      orders: [...orders.filter((order) => order.side !== 'buy'), ...capped.buys],
      skipped: [...skipped, ...capped.skipped],
      target: [],
      cooldown: [],
      waiting: [],
      opening,
      capital,
    };
  }

  const planned = planActiveBook({
    book: code,
    slotCount: BOOKS[code].slots,
    holdings,
    signals,
    priorSignals,
    fallbackList: FALLBACK,
    cooldown: state.cooldown || [],
    decisionDate: sessionDate,
    executionDate,
    sessions,
    opening,
    capital,
    equity: account.equity,
  });
  if (!planned.ok) return planned;
  const kept = planned.target.filter((row) => holdings.some((held) => held.symbol === row.symbol)).map((row) => row.symbol);
  const resolved = resolveExecution({
    book: code,
    orders: planned.orders,
    bench: planned.bench,
    hasBar: eligible,
    keptSymbols: kept,
    opening,
  });
  for (const sell of resolved.sells) {
    const held = holdings.find((row) => row.symbol === sell.symbol);
    sell.qty = held?.qty;
    const close = signals.get(sell.symbol)?.close;
    sell.estimatedProceeds = held && close ? floorCents(Number(held.qty) * close * (1 - COST_RATE)) : 0;
  }
  for (const buy of resolved.buys) {
    if (buy.pairId) {
      const sell = resolved.sells.find((row) => row.pairId === buy.pairId);
      if (sell) buy.notional = sell.estimatedProceeds;
    }
  }
  const sellNotional = resolved.sells.reduce((sum, sell) => sum + Number(sell.estimatedProceeds || 0), 0);
  const capped = capBuysToCash(resolved.buys, inferredCash(account), sellNotional);
  return {
    ok: true,
    orders: [...resolved.sells, ...capped.buys],
    skipped: [...resolved.skipped, ...capped.skipped],
    target: planned.target,
    cooldown: planned.cooldown,
    waiting: waitingAfterExecution(planned.waiting, { buys: capped.buys, sells: resolved.sells }),
    opening,
    capital,
  };
}

/**
 * A live buy cannot spend more than broker cash plus the sales that fund it.
 * That keeps a gap-down on a paired sale from requesting leverage, and it
 * turns an unpaired slice that no longer fits into a skip instead of a failed run.
 */
export function capBuysToCash(buys, cash, sellNotional) {
  const skipped = [];
  const kept = [];
  let left = Number(cash) + Number(sellNotional || 0);
  if (!Number.isFinite(left)) left = 0;
  for (const buy of buys) {
    const want = Number(buy.notional) || 0;
    const capped = floorCents(Math.max(0, Math.min(want, left)));
    if (!(capped >= MIN_NOTIONAL)) {
      skipped.push({ symbol: buy.symbol, side: 'buy', reason: 'below_min_notional' });
      continue;
    }
    buy.notional = capped;
    left -= capped;
    kept.push(buy);
  }
  return { buys: kept, skipped };
}

function waitingAfterExecution(waiting, resolved) {
  const bought = new Set((resolved.buys || []).map((row) => row.symbol));
  const sold = new Set((resolved.sells || []).map((row) => row.symbol));
  return (waiting || []).filter((row) => !bought.has(row.symbol) && !sold.has(row.symbol));
}
