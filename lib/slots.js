import { countSessionsInclusive, floorCents } from './dates.js';
import { dipExit } from './signals.js';
import { reasonFor } from './reasons.js';

function byMomentum(a, b) {
  const delta = (b.momentum ?? -Infinity) - (a.momentum ?? -Infinity);
  if (delta !== 0) return delta;
  return a.symbol.localeCompare(b.symbol);
}

function longestHeldFallback(a, b) {
  if (a.entrySession !== b.entrySession) return a.entrySession < b.entrySession ? -1 : 1;
  return (b.fallbackRank ?? 0) - (a.fallbackRank ?? 0);
}

function longestHeldSignal(a, b) {
  if (a.entrySession !== b.entrySession) return a.entrySession < b.entrySession ? -1 : 1;
  const aDip = a.dipEntrySession || a.entrySession;
  const bDip = b.dipEntrySession || b.entrySession;
  if (aDip !== bDip) return aDip < bDip ? -1 : 1;
  return a.symbol.localeCompare(b.symbol);
}

function snapshot(signal) {
  if (!signal) return {};
  return {
    close: signal.close,
    sma200: signal.sma200,
    sma20: signal.sma20,
    momentum: signal.momentum,
  };
}

function failedOnPriorSession(priorMap, symbol) {
  if (!priorMap) return false;
  const prior = priorMap.get(symbol);
  return Boolean(prior) && prior.trendQualifier === false;
}

function confirmedDipYesterday(priorMap, symbol) {
  if (!priorMap) return true;
  return Boolean(priorMap.get(symbol)?.dipSetup);
}

/**
 * Choose the target slots for Trend or Dip and the orders that get there.
 * A live Trend name keeps its slot. A name that no longer qualifies is sold only
 * after a second failed session and a new trend with stronger 12-to-1 momentum
 * needs that slot, oldest first among the weaker holds. The caller must pass
 * priorSignals from the previous session; without that map a two-session fail
 * is treated as a first-day fail and will not yield. Dip sells on a broken
 * 200-day trend, or when a recovered dip yields to a stronger new dip that
 * was already a dip on the prior session. An unrepaired dip is not sold on a
 * clock. A one-session dip does not take a new slot, including a held fallback
 * that is a dip only today. When several new dips are waiting, the weakest
 * that day does not take a slot.
 */
export function planActiveBook({
  book,
  slotCount,
  holdings,
  signals,
  fallbackList,
  cooldown,
  decisionDate,
  executionDate,
  sessions,
  opening,
  capital,
  equity,
  priorSignals = null,
}) {
  const signalMap = signals instanceof Map ? signals : new Map(signals.map((row) => [row.symbol, row]));
  const priorMap = priorSignals
    ? (priorSignals instanceof Map ? priorSignals : new Map(priorSignals.map((row) => [row.symbol, row])))
    : null;
  const working = holdings.map((row) => ({ ...row }));
  const nextCooldown = new Set(cooldown || []);

  for (const held of working) {
    if (!signalMap.get(held.symbol)) {
      return { ok: false, blocked: 'missing_bar', symbol: held.symbol };
    }
  }

  const exits = [];
  const stayingSignals = [];
  const fallbacksHeld = [];

  if (book === 'dip') {
    for (const held of working) {
      const signal = signalMap.get(held.symbol);
      if (held.slotKind === 'signal' && held.dipEntrySession && held.dipEntrySession <= decisionDate) {
        const heldFor = countSessionsInclusive(sessions, held.dipEntrySession, decisionDate);
        const exitRule = dipExit(signal);
        if (exitRule === 'trend_broken') {
          exits.push({ ...held, ...snapshot(signal), exitRule, holdingSessions: heldFor, slotKind: 'signal' });
          continue;
        }
        stayingSignals.push({
          ...held,
          ...snapshot(signal),
          slotKind: 'signal',
          holdingSessions: heldFor,
          recovered: exitRule === 'dip_repaired',
        });
        continue;
      }
      if (signal.dipSetup && !nextCooldown.has(held.symbol) && confirmedDipYesterday(priorMap, held.symbol)) {
        stayingSignals.push({
          ...held,
          ...snapshot(signal),
          slotKind: 'signal',
          dipEntrySession: held.dipEntrySession && held.dipEntrySession <= decisionDate ? held.dipEntrySession : executionDate,
          fallbackRank: null,
        });
      } else {
        fallbacksHeld.push({ ...held, ...snapshot(signal), slotKind: 'fallback' });
      }
    }
  } else {
    for (const held of working) {
      const signal = signalMap.get(held.symbol);
      const heldFor = countSessionsInclusive(sessions, held.entrySession, decisionDate);
      if (signal.trendQualifier) {
        stayingSignals.push({
          ...held,
          ...snapshot(signal),
          slotKind: 'signal',
          fallbackRank: null,
          dipEntrySession: null,
          holdingSessions: heldFor,
          trendQualifier: true,
        });
      } else if (held.slotKind === 'signal') {
        stayingSignals.push({
          ...held,
          ...snapshot(signal),
          slotKind: 'signal',
          fallbackRank: null,
          dipEntrySession: null,
          holdingSessions: heldFor,
          trendQualifier: false,
        });
      } else {
        fallbacksHeld.push({ ...held, ...snapshot(signal), slotKind: 'fallback' });
      }
    }
  }

  for (const symbol of [...nextCooldown]) {
    const signal = signalMap.get(symbol);
    if (signal && signal.sma20 != null && signal.close > signal.sma20) nextCooldown.delete(symbol);
  }

  const heldSymbols = new Set(working.map((row) => row.symbol));
  const candidates = [];
  for (const signal of signalMap.values()) {
    if (heldSymbols.has(signal.symbol)) continue;
    if (book === 'dip') {
      if (signal.dipSetup && !nextCooldown.has(signal.symbol) && confirmedDipYesterday(priorMap, signal.symbol)) {
        candidates.push(signal);
      }
    } else if (signal.trendQualifier) {
      candidates.push(signal);
    }
  }
  candidates.sort(byMomentum);
  let droppedWeakest = null;
  if (book === 'dip' && candidates.length > 1) droppedWeakest = candidates.pop();

  const yieldHeld = (book === 'dip'
    ? stayingSignals.filter((row) => row.recovered)
    : stayingSignals.filter((row) => row.trendQualifier === false && failedOnPriorSession(priorMap, row.symbol))
  ).sort(longestHeldSignal);
  const rankedFallbacks = [...fallbacksHeld].sort(longestHeldFallback);
  const freeSlots = Math.max(0, slotCount - stayingSignals.length - fallbacksHeld.length);
  const fallbackTake = Math.min(candidates.length, freeSlots + rankedFallbacks.length);
  const extraEntries = [];
  const yieldedSold = [];
  const stillYield = [...yieldHeld];
  for (const candidate of candidates.slice(fallbackTake)) {
    const index = stillYield.findIndex((row) => (candidate.momentum ?? -Infinity) > (row.momentum ?? -Infinity));
    if (index < 0) continue;
    yieldedSold.push(stillYield[index]);
    extraEntries.push(candidate);
    stillYield.splice(index, 1);
  }
  const entries = [...candidates.slice(0, fallbackTake), ...extraEntries];
  const taken = new Set(entries.map((row) => row.symbol));
  const waiting = candidates.filter((row) => !taken.has(row.symbol));
  const sellCount = Math.max(0, stayingSignals.length + fallbacksHeld.length + entries.length - slotCount);
  const fallbacksSold = rankedFallbacks.slice(0, Math.max(0, sellCount - yieldedSold.length));
  const yieldedSoldSet = new Set(yieldedSold.map((row) => row.symbol));
  for (const row of yieldedSold) {
    exits.push({
      ...row,
      exitRule: book === 'dip' ? 'dip_repaired' : 'trend_exit',
      holdingSessions: row.holdingSessions,
      slotKind: 'signal',
    });
  }
  const keptSignals = stayingSignals.filter((row) => !yieldedSoldSet.has(row.symbol));
  const fallbacksKept = rankedFallbacks.slice(fallbacksSold.length);
  const soldSymbols = new Set([...exits.map((row) => row.symbol), ...fallbacksSold.map((row) => row.symbol)]);

  const target = [
    ...keptSignals.map((row) => ({
      symbol: row.symbol,
      slotKind: 'signal',
      entrySession: row.entrySession,
      dipEntrySession: book === 'dip' ? row.dipEntrySession : null,
      fallbackRank: null,
      momentum: row.momentum,
    })),
    ...fallbacksKept.map((row) => ({
      symbol: row.symbol,
      slotKind: 'fallback',
      entrySession: row.entrySession,
      dipEntrySession: null,
      fallbackRank: row.fallbackRank,
      momentum: row.momentum,
    })),
    ...entries.map((row) => ({
      symbol: row.symbol,
      slotKind: 'signal',
      entrySession: executionDate,
      dipEntrySession: book === 'dip' ? executionDate : null,
      fallbackRank: null,
      momentum: row.momentum,
    })),
  ];

  const used = new Set(target.map((row) => row.symbol));
  const bench = [];
  const queued = new Set();
  for (const row of waiting) {
    bench.push(benchItem(row, 'signal', null));
    queued.add(row.symbol);
  }
  fallbackList.forEach((symbol, index) => {
    if (used.has(symbol) || soldSymbols.has(symbol) || queued.has(symbol)) return;
    const rank = index + 1;
    if (target.length < slotCount) {
      target.push({
        symbol,
        slotKind: 'fallback',
        entrySession: executionDate,
        dipEntrySession: null,
        fallbackRank: rank,
        momentum: signalMap.get(symbol)?.momentum ?? null,
      });
      used.add(symbol);
    } else {
      bench.push(benchItem(signalMap.get(symbol), 'fallback', rank, symbol));
      queued.add(symbol);
    }
  });

  const rankingPool = [...keptSignals, ...candidates].sort(byMomentum);
  const rankOf = new Map(rankingPool.map((row, index) => [row.symbol, index + 1]));

  const sells = [...exits, ...fallbacksSold].map((row) => ({
    book,
    symbol: row.symbol,
    side: 'sell',
    slotKind: row.slotKind,
    entrySession: row.entrySession,
    dipEntrySession: row.dipEntrySession ?? null,
    fallbackRank: row.fallbackRank ?? null,
    exitRule: row.exitRule ?? null,
    holdingSessions: row.holdingSessions ?? null,
    executionDate,
    opening: false,
    ...snapshot(row),
  }));

  const buys = target
    .filter((row) => !heldSymbols.has(row.symbol))
    .map((row) => ({
      book,
      symbol: row.symbol,
      side: 'buy',
      slotKind: row.slotKind,
      entrySession: executionDate,
      dipEntrySession: row.dipEntrySession,
      fallbackRank: row.fallbackRank,
      rank: rankOf.get(row.symbol) ?? null,
      momentum: row.momentum,
      executionDate,
      opening: Boolean(opening),
      ...snapshot(signalMap.get(row.symbol)),
    }));

  pairOrders(buys, sells);
  const slice = floorCents((opening ? capital : (equity ?? capital)) / slotCount);
  for (const buy of buys) {
    if (opening || !buy.pairId) buy.notional = slice;
  }
  for (const order of [...buys, ...sells]) order.reason = reasonFor(order);

  return {
    ok: true,
    target,
    orders: [...sells, ...buys],
    bench,
    waiting: collectWaiting({
      book,
      signalMap,
      priorMap,
      cooldown: nextCooldown,
      stayingSignals,
      yieldedSoldSet,
      soldSymbols,
      entries,
      waiting,
      droppedWeakest,
    }),
    cooldown: [...nextCooldown].sort(),
    cashSlots: Math.max(0, slotCount - target.length),
    soldSymbols: [...soldSymbols],
  };
}

const WAITING_REASON_ORDER = {
  one_session_fail: 0,
  one_session_dip: 1,
  weakest_dip: 2,
  no_slot: 3,
};

function collectWaiting({
  book,
  signalMap,
  priorMap,
  cooldown,
  stayingSignals,
  yieldedSoldSet,
  soldSymbols,
  entries,
  waiting,
  droppedWeakest,
}) {
  const rows = [];
  const seen = new Set();
  const taken = new Set(entries.map((row) => row.symbol));

  function add(symbol, reason) {
    if (!symbol || seen.has(symbol) || soldSymbols.has(symbol) || taken.has(symbol)) return;
    seen.add(symbol);
    rows.push({ symbol, reason });
  }

  if (book === 'trend') {
    for (const row of stayingSignals) {
      if (row.trendQualifier === false && !yieldedSoldSet.has(row.symbol) && !failedOnPriorSession(priorMap, row.symbol)) {
        add(row.symbol, 'one_session_fail');
      }
    }
  }

  if (book === 'dip') {
    const liveDip = new Set(stayingSignals.map((row) => row.symbol));
    for (const signal of signalMap.values()) {
      if (!signal.dipSetup || cooldown.has(signal.symbol) || liveDip.has(signal.symbol)) continue;
      if (confirmedDipYesterday(priorMap, signal.symbol)) continue;
      add(signal.symbol, 'one_session_dip');
    }
    if (droppedWeakest) add(droppedWeakest.symbol, 'weakest_dip');
  }

  for (const row of waiting) add(row.symbol, 'no_slot');

  return rows.sort((a, b) => {
    const delta = (WAITING_REASON_ORDER[a.reason] ?? 9) - (WAITING_REASON_ORDER[b.reason] ?? 9);
    if (delta !== 0) return delta;
    return a.symbol.localeCompare(b.symbol);
  });
}

function benchItem(signal, slotKind, fallbackRank, symbol = signal?.symbol) {
  return {
    symbol,
    slotKind,
    fallbackRank,
    rank: null,
    momentum: signal?.momentum ?? null,
    close: signal?.close ?? null,
    sma200: signal?.sma200 ?? null,
    sma20: signal?.sma20 ?? null,
  };
}

function pairOrders(buys, sells) {
  const signalBuys = buys.filter((row) => row.slotKind === 'signal').sort(byMomentum);
  const fallbackBuys = buys.filter((row) => row.slotKind === 'fallback').sort((a, b) => a.fallbackRank - b.fallbackRank);
  const fallbackSells = sells.filter((row) => row.slotKind === 'fallback').sort(longestHeldFallback);
  const signalSells = sells.filter((row) => row.slotKind === 'signal').sort(longestHeldFallback);
  const usedBuys = new Set();
  const usedSells = new Set();
  let pairNumber = 0;

  function pair(buyList, sellList) {
    for (const buy of buyList) {
      if (usedBuys.has(buy.symbol)) continue;
      const sell = sellList.find((row) => !usedSells.has(row.symbol));
      if (!sell) return;
      pairNumber += 1;
      const pairId = `${buy.book}-${pairNumber}`;
      buy.pairId = pairId;
      sell.pairId = pairId;
      buy.pairedSymbol = sell.symbol;
      sell.pairedSymbol = buy.symbol;
      usedBuys.add(buy.symbol);
      usedSells.add(sell.symbol);
    }
  }

  pair(signalBuys, fallbackSells);
  pair(signalBuys, signalSells);
  pair(fallbackBuys, signalSells);
  pair(fallbackBuys, fallbackSells);
}

export function planControl({ basket, opening, capital }) {
  if (!opening) return { ok: true, orders: [], target: [] };
  const slice = floorCents(capital / basket.length);
  const orders = basket.map((symbol) => {
    const order = {
      book: 'control',
      symbol,
      side: 'buy',
      slotKind: 'control',
      opening: true,
      notional: slice,
      executionDate: null,
    };
    order.reason = reasonFor(order);
    return order;
  });
  return { ok: true, orders, slice };
}

/**
 * Walk the planned orders against the execution session.
 * A name with no open is skipped. The next bench name takes that slot.
 * A name sold in this rebalance is not bought back.
 */
export function resolveExecution({ book, orders, bench, hasBar, keptSymbols, opening }) {
  const skipped = [];
  const blockedPairs = new Set();
  const used = new Set(keptSymbols);
  const sells = [];

  for (const order of orders) {
    if (order.side !== 'sell') continue;
    used.add(order.symbol);
    if (!hasBar(order.symbol)) {
      skipped.push({ symbol: order.symbol, side: 'sell', reason: 'no_bar_on_execution_session' });
      if (order.pairId) blockedPairs.add(order.pairId);
      continue;
    }
    sells.push(order);
  }

  const queue = bench.map((row) => ({ ...row }));
  function nextEligible() {
    while (queue.length > 0) {
      const candidate = queue.shift();
      if (used.has(candidate.symbol)) continue;
      if (!hasBar(candidate.symbol)) {
        skipped.push({ symbol: candidate.symbol, side: 'buy', reason: 'no_bar_on_execution_session' });
        continue;
      }
      used.add(candidate.symbol);
      return candidate;
    }
    return null;
  }

  const buys = [];
  for (const order of orders) {
    if (order.side !== 'buy') continue;
    if (order.pairId && blockedPairs.has(order.pairId)) {
      skipped.push({ symbol: order.symbol, side: 'buy', reason: 'paired_sell_skipped' });
      continue;
    }
    if (hasBar(order.symbol) && !used.has(order.symbol)) {
      used.add(order.symbol);
      buys.push(order);
      continue;
    }
    if (!hasBar(order.symbol)) {
      skipped.push({ symbol: order.symbol, side: 'buy', reason: 'no_bar_on_execution_session' });
    }
    const replacement = nextEligible();
    if (!replacement) {
      skipped.push({ symbol: order.symbol, side: 'buy', reason: 'slot_left_in_cash' });
      continue;
    }
    const replaced = {
      ...order,
      symbol: replacement.symbol,
      slotKind: replacement.slotKind,
      fallbackRank: replacement.fallbackRank,
      rank: replacement.rank,
      momentum: replacement.momentum,
      close: replacement.close,
      sma200: replacement.sma200,
      sma20: replacement.sma20,
      dipEntrySession: replacement.slotKind === 'signal' && book === 'dip' ? order.executionDate : null,
    };
    replaced.reason = reasonFor(replaced);
    buys.push(replaced);
  }

  return { sells, buys, skipped, opening: Boolean(opening) };
}
