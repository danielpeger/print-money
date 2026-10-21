import { BASKET, BOOKS, BOOK_CAPITAL, FALLBACK, MIN_NOTIONAL, SMA_LONG } from './config.js';
import { floorCents } from './dates.js';
import { signalSeries } from './indicators.js';
import { applyFills, applyTargetMetadata, createBook, markToMarket } from './portfolio.js';
import { planActiveBook, resolveExecution } from './slots.js';

function holdingsOf(book) {
  return [...book.positions.entries()].map(([symbol, position]) => ({
    symbol,
    slotKind: position.slotKind,
    entrySession: position.entrySession,
    dipEntrySession: position.dipEntrySession,
    fallbackRank: position.fallbackRank,
  }));
}

export function signalsForDate(signalMaps, date) {
  const map = new Map();
  for (const [symbol, byDate] of signalMaps) {
    const row = byDate.get(date);
    if (row) map.set(symbol, row);
  }
  return map;
}

export function priorSignalsForDate(signalMaps, sessions, date) {
  const index = sessions.lastIndexOf(date);
  if (index <= 0) return null;
  return signalsForDate(signalMaps, sessions[index - 1]);
}

function decisionEquity(book, date, indexes) {
  const marked = markToMarket(book, (symbol) => indexes.get(symbol)?.carryClose(date));
  return marked.ok ? marked.equity : book.cash;
}

export function buildSignalMaps(barsBySymbol) {
  const maps = new Map();
  for (const symbol of BASKET) {
    const bars = (barsBySymbol[symbol] || []).map((bar) => ({ ...bar, symbol }));
    const byDate = new Map();
    for (const row of signalSeries(bars)) byDate.set(row.date, row);
    maps.set(symbol, byDate);
  }
  return maps;
}

/**
 * Trend or Dip over the comparison window.
 * Signals on session T fill at the open of the next session. The fill never uses T+1's close.
 */
export function simulateActive({
  bookName,
  sessions,
  indexes,
  signalMaps,
  comparisonStart,
  comparisonEnd,
  costRate,
  capital = BOOK_CAPITAL,
  slotCount = BOOKS[bookName].slots,
  fallbackList = FALLBACK,
}) {
  const book = createBook(capital);
  const curve = [];
  const trades = [];
  const skipped = [];
  const blocked = [];
  let fills = 0;
  let tradedNotional = 0;
  let carriedMarks = 0;
  let carriedSessions = 0;
  let pending = null;
  let opened = false;

  for (let i = 0; i < sessions.length; i++) {
    const session = sessions[i];
    if (session > comparisonEnd) break;

    if (pending && pending.executionDate === session) {
      const kept = pending.target.filter((row) => book.positions.has(row.symbol)).map((row) => row.symbol);
      applyTargetMetadata(book, pending.target);
      const resolved = resolveExecution({
        book: bookName,
        orders: pending.orders,
        bench: pending.bench,
        hasBar: (symbol) => indexes.get(symbol)?.open(session) != null,
        keptSymbols: kept,
        opening: pending.opening,
      });
      const applied = applyFills({
        book,
        sells: resolved.sells,
        buys: resolved.buys,
        openPrice: (symbol) => indexes.get(symbol)?.open(session),
        costRate,
        minNotional: MIN_NOTIONAL,
      });
      fills += applied.fills.length;
      for (const fill of applied.fills) tradedNotional += fill.notional;
      trades.push(...applied.trades);
      skipped.push(...resolved.skipped, ...applied.skipped);
      if (pending.opening) opened = true;
      pending = null;
    }

    if (session >= comparisonStart && session <= comparisonEnd) {
      const marked = markToMarket(book, (symbol) => indexes.get(symbol)?.carryClose(session));
      if (!marked.ok) return { ok: false, reason: 'mark_failed', symbol: marked.symbol, date: session };
      if (marked.carried > 0) carriedSessions += 1;
      carriedMarks += marked.carried;
      curve.push({ date: session, equity: marked.equity });
    }

    const executionDate = sessions[i + 1];
    if (!executionDate || executionDate < comparisonStart || executionDate > comparisonEnd) continue;
    if (i < SMA_LONG - 1) continue;

    const plan = planActiveBook({
      book: bookName,
      slotCount,
      holdings: holdingsOf(book),
      signals: signalsForDate(signalMaps, session),
      priorSignals: priorSignalsForDate(signalMaps, sessions, session),
      fallbackList,
      cooldown: book.cooldown,
      decisionDate: session,
      executionDate,
      sessions,
      opening: !opened,
      capital,
      equity: decisionEquity(book, session, indexes),
    });
    if (!plan.ok) {
      blocked.push({ date: session, symbol: plan.symbol, blocked: plan.blocked });
      pending = null;
      continue;
    }
    book.cooldown = new Set(plan.cooldown);
    pending = { ...plan, executionDate, opening: !opened };
  }

  return {
    ok: true,
    curve,
    trades,
    fills,
    tradedNotional,
    skipped,
    blocked,
    carriedMarks,
    carriedSessions,
    cash: book.cash,
    positions: book.positions.size,
    holdings: [...book.positions.entries()].map(([symbol, position]) => ({
      symbol,
      shares: position.shares,
      slotKind: position.slotKind,
    })),
  };
}

/** Buy the named symbols on the comparison start and hold them. A missing open stays in cash. */
export function simulateHold({
  symbols,
  sessions,
  indexes,
  comparisonStart,
  comparisonEnd,
  costRate,
  capital = BOOK_CAPITAL,
}) {
  const book = createBook(capital);
  const curve = [];
  const missing = [];
  const slice = floorCents(capital / symbols.length);
  let fills = 0;
  let tradedNotional = 0;
  let carriedMarks = 0;
  let carriedSessions = 0;

  for (const session of sessions) {
    if (session < comparisonStart) continue;
    if (session > comparisonEnd) break;
    if (session === comparisonStart) {
      for (const symbol of symbols) {
        const open = indexes.get(symbol)?.open(session);
        if (open == null) {
          missing.push(symbol);
          continue;
        }
        const applied = applyFills({
          book,
          sells: [],
          buys: [{
            symbol,
            side: 'buy',
            slotKind: 'control',
            notional: slice,
            executionDate: session,
            dipEntrySession: null,
            fallbackRank: null,
            book: 'control',
          }],
          openPrice: () => open,
          costRate,
          minNotional: MIN_NOTIONAL,
        });
        fills += applied.fills.length;
        for (const fill of applied.fills) tradedNotional += fill.notional;
      }
    }
    const marked = markToMarket(book, (symbol) => indexes.get(symbol)?.carryClose(session));
    if (!marked.ok) return { ok: false, reason: 'mark_failed', symbol: marked.symbol, date: session };
    if (marked.carried > 0) carriedSessions += 1;
    carriedMarks += marked.carried;
    curve.push({ date: session, equity: marked.equity });
  }

  return {
    ok: true,
    curve,
    trades: [],
    fills,
    tradedNotional,
    missing,
    skipped: [],
    blocked: [],
    carriedMarks,
    carriedSessions,
    cash: book.cash,
    positions: book.positions.size,
    holdings: [...book.positions.entries()].map(([symbol, position]) => ({
      symbol,
      shares: position.shares,
    })),
  };
}
