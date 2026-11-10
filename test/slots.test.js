import assert from 'node:assert/strict';
import test from 'node:test';
import { planActiveBook, resolveExecution } from '../lib/slots.js';

const sessions = Array.from({ length: 40 }, (_, index) => `2024-03-${String(index + 1).padStart(2, '0')}`);

function signal(symbol, momentum, extras = {}) {
  return {
    symbol,
    date: '2024-03-20',
    close: 20,
    sma200: 10,
    sma20: 18,
    momentum,
    warmed: true,
    trendQualifier: true,
    dipSetup: false,
    ...extras,
  };
}

function names(plan, side) {
  return plan.orders.filter((order) => order.side === side).map((order) => order.symbol);
}

test('opening fills slots with the strongest signals and does not rescale a skipped name', () => {
  const plan = planActiveBook({
    book: 'trend',
    slotCount: 2,
    holdings: [],
    signals: [signal('AAA', 0.3), signal('BBB', 0.2), signal('CCC', 0.1)],
    fallbackList: ['ZZZ', 'YYY'],
    cooldown: [],
    decisionDate: '2024-03-20',
    executionDate: '2024-03-21',
    sessions,
    opening: true,
    capital: 5000,
  });
  assert.deepEqual(plan.target.map((row) => row.symbol), ['AAA', 'BBB']);
  assert.equal(plan.orders[0].notional, 2500);
  assert.equal(plan.bench[0].symbol, 'CCC');
  assert.deepEqual(plan.waiting, [{ symbol: 'CCC', reason: 'no_slot' }]);
});

test('a held signal is not pushed out by a stronger name', () => {
  const plan = planActiveBook({
    book: 'trend',
    slotCount: 2,
    holdings: [
      { symbol: 'AAA', slotKind: 'signal', entrySession: '2024-03-01', fallbackRank: null },
      { symbol: 'BBB', slotKind: 'signal', entrySession: '2024-03-01', fallbackRank: null },
    ],
    signals: [signal('AAA', 0.1), signal('BBB', 0.1), signal('CCC', 0.9)],
    fallbackList: ['ZZZ'],
    cooldown: [],
    decisionDate: '2024-03-20',
    executionDate: '2024-03-21',
    sessions,
    opening: false,
    capital: 5000,
    equity: 5000,
  });
  assert.deepEqual(names(plan, 'buy'), []);
  assert.deepEqual(names(plan, 'sell'), []);
  assert.equal(plan.bench[0].symbol, 'CCC');
  assert.deepEqual(plan.waiting, [{ symbol: 'CCC', reason: 'no_slot' }]);
});

test('a new signal sells the longest-held fallback, and a tie sells the later rank', () => {
  const plan = planActiveBook({
    book: 'trend',
    slotCount: 2,
    holdings: [
      { symbol: 'EARLY', slotKind: 'fallback', entrySession: '2024-03-01', fallbackRank: 1 },
      { symbol: 'LATER', slotKind: 'fallback', entrySession: '2024-03-01', fallbackRank: 10 },
    ],
    signals: [signal('HOT', 0.4), signal('EARLY', 0, { trendQualifier: false }), signal('LATER', 0, { trendQualifier: false })],
    fallbackList: ['EARLY', 'LATER'],
    cooldown: [],
    decisionDate: '2024-03-20',
    executionDate: '2024-03-21',
    sessions,
    opening: false,
    capital: 5000,
    equity: 5000,
  });
  assert.deepEqual(names(plan, 'sell'), ['LATER']);
  assert.deepEqual(names(plan, 'buy'), ['HOT']);
  const sold = plan.orders.find((order) => order.symbol === 'LATER');
  assert.equal(sold.pairedSymbol, 'HOT');
  assert.match(sold.reason, /free a slot/);
});

test('a held Trend name that no longer qualifies stays until a new trend needs the slot', () => {
  const plan = planActiveBook({
    book: 'trend',
    slotCount: 1,
    holdings: [{ symbol: 'XYZ', slotKind: 'signal', entrySession: '2024-03-01', fallbackRank: null }],
    signals: [signal('XYZ', -0.2, { trendQualifier: false, close: 8, sma200: 10 })],
    fallbackList: ['CASHY'],
    cooldown: [],
    decisionDate: '2024-03-20',
    executionDate: '2024-03-21',
    sessions,
    opening: false,
    capital: 5000,
    equity: 5000,
  });
  assert.deepEqual(names(plan, 'sell'), []);
  assert.deepEqual(names(plan, 'buy'), []);
  assert.equal(plan.target[0].symbol, 'XYZ');
});

test('a stronger new trend sells the oldest weaker name that no longer qualifies', () => {
  const plan = planActiveBook({
    book: 'trend',
    slotCount: 2,
    holdings: [
      { symbol: 'OLDER', slotKind: 'signal', entrySession: sessions[1], fallbackRank: null },
      { symbol: 'NEWER', slotKind: 'signal', entrySession: sessions[5], fallbackRank: null },
    ],
    signals: [
      signal('OLDER', -0.1, { trendQualifier: false, close: 8, sma200: 10 }),
      signal('NEWER', -0.2, { trendQualifier: false, close: 9, sma200: 10 }),
      signal('HOT', 0.5),
    ],
    priorSignals: [
      signal('OLDER', -0.05, { trendQualifier: false, close: 8.5, sma200: 10 }),
      signal('NEWER', -0.15, { trendQualifier: false, close: 9.2, sma200: 10 }),
      signal('HOT', 0.4),
    ],
    fallbackList: ['CASHY'],
    cooldown: [],
    decisionDate: '2024-03-20',
    executionDate: '2024-03-21',
    sessions,
    opening: false,
    capital: 5000,
    equity: 5000,
  });
  assert.deepEqual(names(plan, 'sell'), ['OLDER']);
  assert.deepEqual(names(plan, 'buy'), ['HOT']);
  assert.equal(plan.orders.find((order) => order.symbol === 'OLDER').exitRule, 'trend_exit');
  assert.equal(plan.orders.find((order) => order.symbol === 'OLDER').pairedSymbol, 'HOT');
  assert.equal(plan.target.find((row) => row.symbol === 'NEWER').symbol, 'NEWER');
});

test('a live Trend name is not sold to make room for a new trend', () => {
  const plan = planActiveBook({
    book: 'trend',
    slotCount: 1,
    holdings: [{ symbol: 'LIVE', slotKind: 'signal', entrySession: sessions[0], fallbackRank: null }],
    signals: [signal('LIVE', 0.1), signal('HOT', 0.9)],
    fallbackList: ['CASHY'],
    cooldown: [],
    decisionDate: '2024-03-20',
    executionDate: '2024-03-21',
    sessions,
    opening: false,
    capital: 5000,
    equity: 5000,
  });
  assert.deepEqual(names(plan, 'sell'), []);
  assert.deepEqual(names(plan, 'buy'), []);
  assert.equal(plan.bench[0].symbol, 'HOT');
  assert.equal(plan.target[0].symbol, 'LIVE');
});

test('a name sold in the rebalance is not bought back as a fallback', () => {
  const plan = planActiveBook({
    book: 'trend',
    slotCount: 1,
    holdings: [{ symbol: 'XYZ', slotKind: 'signal', entrySession: '2024-03-01', fallbackRank: null }],
    signals: [
      signal('XYZ', -0.2, { trendQualifier: false, close: 8, sma200: 10 }),
      signal('HOT', 0.4),
    ],
    priorSignals: [signal('XYZ', -0.1, { trendQualifier: false, close: 8.5, sma200: 10 })],
    fallbackList: ['XYZ'],
    cooldown: [],
    decisionDate: '2024-03-20',
    executionDate: '2024-03-21',
    sessions,
    opening: false,
    capital: 5000,
    equity: 5000,
  });
  assert.deepEqual(names(plan, 'sell'), ['XYZ']);
  assert.deepEqual(names(plan, 'buy'), ['HOT']);
  assert.equal(plan.orders.find((order) => order.symbol === 'XYZ').pairedSymbol, 'HOT');
});

test('an unrepaired dip is not sold on a clock', () => {
  const plan = planActiveBook({
    book: 'dip',
    slotCount: 1,
    holdings: [{ symbol: 'DIP', slotKind: 'signal', entrySession: sessions[0], dipEntrySession: sessions[0], fallbackRank: null }],
    signals: [signal('DIP', 0.2, { dipSetup: true, close: 10, sma200: 9, sma20: 12 })],
    fallbackList: ['CASHY'],
    cooldown: [],
    decisionDate: sessions[20],
    executionDate: sessions[21],
    sessions,
    opening: false,
    capital: 1000,
    equity: 1000,
  });
  assert.deepEqual(names(plan, 'sell'), []);
  assert.deepEqual(names(plan, 'buy'), []);
  assert.equal(plan.target[0].symbol, 'DIP');
});

test('a weaker new trend does not sell a failed hold with stronger momentum', () => {
  const plan = planActiveBook({
    book: 'trend',
    slotCount: 1,
    holdings: [{ symbol: 'HELD', slotKind: 'signal', entrySession: sessions[0], fallbackRank: null }],
    signals: [
      signal('HELD', 0.2, { trendQualifier: false, close: 8, sma200: 10 }),
      signal('HOT', 0.05),
    ],
    fallbackList: ['CASHY'],
    cooldown: [],
    decisionDate: '2024-03-20',
    executionDate: '2024-03-21',
    sessions,
    opening: false,
    capital: 5000,
    equity: 5000,
  });
  assert.deepEqual(names(plan, 'sell'), []);
  assert.deepEqual(names(plan, 'buy'), []);
  assert.equal(plan.target[0].symbol, 'HELD');
  assert.equal(plan.bench[0].symbol, 'HOT');
});

test('a repaired dip stays until a stronger new dip needs the slot', () => {
  const held = [{ symbol: 'OLD', slotKind: 'signal', entrySession: sessions[0], dipEntrySession: sessions[0], fallbackRank: null }];
  const recovered = signal('OLD', 0.2, { dipSetup: false, close: 12, sma200: 9, sma20: 11 });
  const without = planActiveBook({
    book: 'dip',
    slotCount: 1,
    holdings: held,
    signals: [recovered],
    fallbackList: ['CASHY'],
    cooldown: [],
    decisionDate: sessions[5],
    executionDate: sessions[6],
    sessions,
    opening: false,
    capital: 1000,
    equity: 1000,
  });
  assert.deepEqual(names(without, 'sell'), []);
  assert.equal(without.target[0].symbol, 'OLD');
  const withNew = planActiveBook({
    book: 'dip',
    slotCount: 1,
    holdings: held,
    signals: [recovered, signal('HOT', 0.5, { dipSetup: true, close: 10, sma200: 9, sma20: 11 })],
    priorSignals: [signal('HOT', 0.4, { dipSetup: true, close: 10.2, sma200: 9, sma20: 11 })],
    fallbackList: ['CASHY'],
    cooldown: [],
    decisionDate: sessions[5],
    executionDate: sessions[6],
    sessions,
    opening: false,
    capital: 1000,
    equity: 1000,
  });
  assert.deepEqual(names(withNew, 'sell'), ['OLD']);
  assert.deepEqual(names(withNew, 'buy'), ['HOT']);
  const sold = withNew.orders.find((order) => order.symbol === 'OLD');
  assert.equal(sold.exitRule, 'dip_repaired');
  assert.match(sold.reason, /back above the 20-day SMA 11.00/);
});

test('a one-session dip on a held fallback does not promote and can yield to a two-session dip', () => {
  const plan = planActiveBook({
    book: 'dip',
    slotCount: 1,
    holdings: [{ symbol: 'FB', slotKind: 'fallback', entrySession: sessions[0], fallbackRank: 1 }],
    signals: [
      signal('FB', 0.1, { dipSetup: true, close: 10, sma200: 9, sma20: 12 }),
      signal('HOT', 0.9, { dipSetup: true, close: 10, sma200: 9, sma20: 11 }),
    ],
    priorSignals: [
      signal('FB', 0.1, { dipSetup: false, close: 12, sma200: 9, sma20: 11 }),
      signal('HOT', 0.8, { dipSetup: true, close: 10.2, sma200: 9, sma20: 11 }),
    ],
    fallbackList: ['FB', 'CASHY'],
    cooldown: [],
    decisionDate: sessions[5],
    executionDate: sessions[6],
    sessions,
    opening: false,
    capital: 1000,
    equity: 1000,
  });
  assert.deepEqual(names(plan, 'sell'), ['FB']);
  assert.deepEqual(names(plan, 'buy'), ['HOT']);
  assert.equal(plan.target[0].symbol, 'HOT');
  assert.equal(plan.target[0].slotKind, 'signal');
  const sold = plan.orders.find((order) => order.side === 'sell');
  assert.equal(sold.slotKind, 'fallback');
  assert.match(sold.reason, /free a slot/);
  assert.doesNotMatch(sold.reason, /back above the 20-day SMA/);
});

test('a two-session dip on a held fallback promotes and is not sold for a stronger new dip', () => {
  const plan = planActiveBook({
    book: 'dip',
    slotCount: 1,
    holdings: [{ symbol: 'FB', slotKind: 'fallback', entrySession: sessions[0], fallbackRank: 1 }],
    signals: [
      signal('FB', 0.1, { dipSetup: true, close: 10, sma200: 9, sma20: 12 }),
      signal('HOT', 0.9, { dipSetup: true, close: 10, sma200: 9, sma20: 11 }),
    ],
    priorSignals: [
      signal('FB', 0.1, { dipSetup: true, close: 10.2, sma200: 9, sma20: 12 }),
      signal('HOT', 0.8, { dipSetup: true, close: 10.2, sma200: 9, sma20: 11 }),
    ],
    fallbackList: ['FB', 'CASHY'],
    cooldown: [],
    decisionDate: sessions[5],
    executionDate: sessions[6],
    sessions,
    opening: false,
    capital: 1000,
    equity: 1000,
  });
  assert.deepEqual(names(plan, 'sell'), []);
  assert.deepEqual(names(plan, 'buy'), []);
  assert.equal(plan.target[0].symbol, 'FB');
  assert.equal(plan.target[0].slotKind, 'signal');
  assert.equal(plan.bench[0].symbol, 'HOT');
});

test('a one-session dip does not take a slot from a recovered hold', () => {
  const plan = planActiveBook({
    book: 'dip',
    slotCount: 1,
    holdings: [{ symbol: 'OLD', slotKind: 'signal', entrySession: sessions[0], dipEntrySession: sessions[0], fallbackRank: null }],
    signals: [
      signal('OLD', 0.2, { dipSetup: false, close: 12, sma200: 9, sma20: 11 }),
      signal('HOT', 0.5, { dipSetup: true, close: 10, sma200: 9, sma20: 11 }),
    ],
    priorSignals: [
      signal('OLD', 0.2, { dipSetup: false, close: 11.5, sma200: 9, sma20: 11 }),
      signal('HOT', 0.4, { dipSetup: false, close: 12, sma200: 9, sma20: 11 }),
    ],
    fallbackList: ['CASHY'],
    cooldown: [],
    decisionDate: sessions[5],
    executionDate: sessions[6],
    sessions,
    opening: false,
    capital: 1000,
    equity: 1000,
  });
  assert.deepEqual(names(plan, 'sell'), []);
  assert.equal(plan.target[0].symbol, 'OLD');
  assert.equal(plan.bench.find((row) => row.symbol === 'HOT'), undefined);
  assert.deepEqual(plan.waiting, [{ symbol: 'HOT', reason: 'one_session_dip' }]);
});

test('the weakest new dip that day does not take a slot', () => {
  const plan = planActiveBook({
    book: 'dip',
    slotCount: 2,
    holdings: [
      { symbol: 'OLD1', slotKind: 'signal', entrySession: sessions[0], dipEntrySession: sessions[0], fallbackRank: null },
      { symbol: 'OLD2', slotKind: 'signal', entrySession: sessions[0], dipEntrySession: sessions[0], fallbackRank: null },
    ],
    signals: [
      signal('OLD1', 0.1, { dipSetup: false, close: 12, sma200: 9, sma20: 11 }),
      signal('OLD2', 0.1, { dipSetup: false, close: 12, sma200: 9, sma20: 11 }),
      signal('HOT', 0.5, { dipSetup: true, close: 10, sma200: 9, sma20: 11 }),
      signal('WARM', 0.3, { dipSetup: true, close: 10, sma200: 9, sma20: 11 }),
    ],
    priorSignals: [
      signal('HOT', 0.4, { dipSetup: true, close: 10.2, sma200: 9, sma20: 11 }),
      signal('WARM', 0.25, { dipSetup: true, close: 10.2, sma200: 9, sma20: 11 }),
    ],
    fallbackList: ['CASHY'],
    cooldown: [],
    decisionDate: sessions[5],
    executionDate: sessions[6],
    sessions,
    opening: false,
    capital: 1000,
    equity: 1000,
  });
  assert.deepEqual(names(plan, 'buy'), ['HOT']);
  assert.equal(names(plan, 'sell').length, 1);
  assert.equal(plan.orders.find((order) => order.symbol === 'WARM'), undefined);
  assert.deepEqual(plan.waiting, [{ symbol: 'WARM', reason: 'weakest_dip' }]);
});

test('a two-session dip can take a slot from a recovered hold', () => {
  const plan = planActiveBook({
    book: 'dip',
    slotCount: 1,
    holdings: [{ symbol: 'OLD', slotKind: 'signal', entrySession: sessions[0], dipEntrySession: sessions[0], fallbackRank: null }],
    signals: [
      signal('OLD', 0.2, { dipSetup: false, close: 12, sma200: 9, sma20: 11 }),
      signal('HOT', 0.5, { dipSetup: true, close: 10, sma200: 9, sma20: 11 }),
    ],
    priorSignals: [signal('HOT', 0.4, { dipSetup: true, close: 10.2, sma200: 9, sma20: 11 })],
    fallbackList: ['CASHY'],
    cooldown: [],
    decisionDate: sessions[5],
    executionDate: sessions[6],
    sessions,
    opening: false,
    capital: 1000,
    equity: 1000,
  });
  assert.deepEqual(names(plan, 'sell'), ['OLD']);
  assert.deepEqual(names(plan, 'buy'), ['HOT']);
});

test('a weaker new dip does not sell a recovered hold with stronger momentum', () => {
  const plan = planActiveBook({
    book: 'dip',
    slotCount: 1,
    holdings: [{ symbol: 'OLD', slotKind: 'signal', entrySession: sessions[0], dipEntrySession: sessions[0], fallbackRank: null }],
    signals: [
      signal('OLD', 0.4, { dipSetup: false, close: 12, sma200: 9, sma20: 11 }),
      signal('HOT', 0.1, { dipSetup: true, close: 10, sma200: 9, sma20: 11 }),
    ],
    fallbackList: ['CASHY'],
    cooldown: [],
    decisionDate: sessions[5],
    executionDate: sessions[6],
    sessions,
    opening: false,
    capital: 1000,
    equity: 1000,
  });
  assert.deepEqual(names(plan, 'sell'), []);
  assert.equal(plan.target[0].symbol, 'OLD');
  assert.equal(plan.bench[0].symbol, 'HOT');
});

test('a two-session Trend fail does not yield when priorSignals are missing', () => {
  const plan = planActiveBook({
    book: 'trend',
    slotCount: 1,
    holdings: [{ symbol: 'XYZ', slotKind: 'signal', entrySession: sessions[0], fallbackRank: null }],
    signals: [
      signal('XYZ', -0.2, { trendQualifier: false, close: 8, sma200: 10 }),
      signal('HOT', 0.5),
    ],
    fallbackList: ['CASHY'],
    cooldown: [],
    decisionDate: '2024-03-20',
    executionDate: '2024-03-21',
    sessions,
    opening: false,
    capital: 5000,
    equity: 5000,
  });
  assert.deepEqual(names(plan, 'sell'), []);
  assert.equal(plan.target[0].symbol, 'XYZ');
  assert.equal(plan.bench[0].symbol, 'HOT');
});

test('a Trend name that failed only today is not sold for a new trend', () => {
  const plan = planActiveBook({
    book: 'trend',
    slotCount: 1,
    holdings: [{ symbol: 'XYZ', slotKind: 'signal', entrySession: sessions[0], fallbackRank: null }],
    signals: [
      signal('XYZ', -0.2, { trendQualifier: false, close: 8, sma200: 10 }),
      signal('HOT', 0.5),
    ],
    priorSignals: [signal('XYZ', 0.1), signal('HOT', 0.4)],
    fallbackList: ['CASHY'],
    cooldown: [],
    decisionDate: '2024-03-20',
    executionDate: '2024-03-21',
    sessions,
    opening: false,
    capital: 5000,
    equity: 5000,
  });
  assert.deepEqual(names(plan, 'sell'), []);
  assert.equal(plan.target[0].symbol, 'XYZ');
  assert.equal(plan.bench[0].symbol, 'HOT');
  assert.deepEqual(plan.waiting, [
    { symbol: 'XYZ', reason: 'one_session_fail' },
    { symbol: 'HOT', reason: 'no_slot' },
  ]);
});

test('a one-session dip on a held fallback stays a fallback and is listed as waiting', () => {
  const plan = planActiveBook({
    book: 'dip',
    slotCount: 1,
    holdings: [{ symbol: 'FB', slotKind: 'fallback', entrySession: sessions[0], fallbackRank: 1 }],
    signals: [signal('FB', 0.1, { dipSetup: true, close: 10, sma200: 9, sma20: 12 })],
    priorSignals: [signal('FB', 0.1, { dipSetup: false, close: 12, sma200: 9, sma20: 11 })],
    fallbackList: ['FB', 'CASHY'],
    cooldown: [],
    decisionDate: sessions[5],
    executionDate: sessions[6],
    sessions,
    opening: false,
    capital: 1000,
    equity: 1000,
  });
  assert.deepEqual(names(plan, 'sell'), []);
  assert.equal(plan.target[0].symbol, 'FB');
  assert.equal(plan.target[0].slotKind, 'fallback');
  assert.deepEqual(plan.waiting, [{ symbol: 'FB', reason: 'one_session_dip' }]);
});

test('a broken trend still sells a dip even when no new dip is waiting', () => {
  const plan = planActiveBook({
    book: 'dip',
    slotCount: 1,
    holdings: [{ symbol: 'OLD', slotKind: 'signal', entrySession: sessions[0], dipEntrySession: sessions[0], fallbackRank: null }],
    signals: [
      signal('OLD', -0.1, { dipSetup: false, trendQualifier: false, close: 8, sma200: 9, sma20: 10 }),
      signal('CASHY', 0, { trendQualifier: false, dipSetup: false }),
    ],
    fallbackList: ['CASHY'],
    cooldown: [],
    decisionDate: sessions[20],
    executionDate: sessions[21],
    sessions,
    opening: false,
    capital: 1000,
    equity: 1000,
  });
  assert.equal(plan.orders.find((order) => order.symbol === 'OLD').exitRule, 'trend_broken');
  assert.deepEqual(names(plan, 'buy'), ['CASHY']);
});

test('an unrepaired dip is not sold to make room for a new dip', () => {
  const plan = planActiveBook({
    book: 'dip',
    slotCount: 1,
    holdings: [{ symbol: 'OPEN', slotKind: 'signal', entrySession: sessions[0], dipEntrySession: sessions[0], fallbackRank: null }],
    signals: [
      signal('OPEN', 0.1, { dipSetup: true, close: 10, sma200: 9, sma20: 12 }),
      signal('HOT', 0.9, { dipSetup: true, close: 10, sma200: 9, sma20: 11 }),
    ],
    fallbackList: ['CASHY'],
    cooldown: [],
    decisionDate: sessions[10],
    executionDate: sessions[11],
    sessions,
    opening: false,
    capital: 1000,
    equity: 1000,
  });
  assert.deepEqual(names(plan, 'sell'), []);
  assert.deepEqual(names(plan, 'buy'), []);
  assert.equal(plan.bench[0].symbol, 'HOT');
  assert.equal(plan.target[0].symbol, 'OPEN');
});

test('a missing execution bar takes the next eligible name', () => {
  const plan = planActiveBook({
    book: 'trend',
    slotCount: 1,
    holdings: [],
    signals: [signal('AAA', 0.4), signal('BBB', 0.3)],
    fallbackList: ['ZZZ'],
    cooldown: [],
    decisionDate: '2024-03-20',
    executionDate: '2024-03-21',
    sessions,
    opening: true,
    capital: 100,
  });
  const resolved = resolveExecution({
    book: 'trend',
    orders: plan.orders,
    bench: plan.bench,
    hasBar: (symbol) => symbol === 'BBB',
    keptSymbols: [],
    opening: true,
  });
  assert.deepEqual(resolved.buys.map((order) => order.symbol), ['BBB']);
  assert.equal(resolved.buys[0].notional, plan.orders.find((order) => order.side === 'buy').notional);
});
