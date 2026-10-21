import assert from 'node:assert/strict';
import test from 'node:test';
import { COST_RATE, FALLBACK } from '../lib/config.js';
import { floorCents } from '../lib/dates.js';
import { planBook } from '../lib/plan-book.js';
import { checkExposure } from '../lib/risk.js';

function signal(symbol, momentum, extras = {}) {
  return {
    symbol,
    date: extras.date || '2024-03-20',
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

function asMap(rows) {
  return new Map(rows.map((row) => [row.symbol, row]));
}

function names(plan, side) {
  return plan.orders.filter((order) => order.side === side).map((order) => order.symbol);
}

function fullTrendBook(failedSymbol, incoming) {
  const held = FALLBACK.map((symbol) => ({
    symbol,
    slotKind: 'signal',
    entrySession: '2024-03-01',
    dipEntrySession: null,
    fallbackRank: null,
  }));
  const today = FALLBACK.map((symbol) => (
    symbol === failedSymbol
      ? signal(symbol, -0.2, { trendQualifier: false, close: 8, sma200: 10 })
      : signal(symbol, 0.1)
  ));
  today.push(signal(incoming, 0.9));
  return {
    held,
    today,
    account: {
      positions: held.map((row) => ({ symbol: row.symbol, qty: '1' })),
      openOrders: [],
      equity: 5000,
    },
  };
}

test('paper Trend yields a two-session fail when yesterday\'s signals are passed', () => {
  const { held, today, account } = fullTrendBook('PFE', 'DIS');
  const plan = planBook({
    code: 'trend',
    state: { positions: held, cooldown: [], opened: true },
    account,
    signals: asMap(today),
    priorSignals: asMap([
      signal('PFE', -0.1, { date: '2024-03-19', trendQualifier: false, close: 8.5, sma200: 10 }),
    ]),
    sessions: ['2024-03-19', '2024-03-20'],
    sessionDate: '2024-03-20',
    executionDate: '2024-03-21',
    eligible: () => true,
  });
  assert.equal(plan.ok, true);
  assert.deepEqual(names(plan, 'sell'), ['PFE']);
  assert.deepEqual(names(plan, 'buy'), ['DIS']);
});

test('paper Trend keeps a failed slot when yesterday\'s signals are omitted', () => {
  const { held, today, account } = fullTrendBook('PFE', 'DIS');
  const plan = planBook({
    code: 'trend',
    state: { positions: held, cooldown: [], opened: true },
    account,
    signals: asMap(today),
    sessions: ['2024-03-19', '2024-03-20'],
    sessionDate: '2024-03-20',
    executionDate: '2024-03-21',
    eligible: () => true,
  });
  assert.equal(plan.ok, true);
  assert.deepEqual(names(plan, 'sell'), []);
  assert.equal(plan.target.find((row) => row.symbol === 'PFE')?.slotKind, 'signal');
  assert.equal(plan.orders.find((order) => order.symbol === 'DIS'), undefined);
  assert.deepEqual(plan.waiting, [
    { symbol: 'PFE', reason: 'one_session_fail' },
    { symbol: 'DIS', reason: 'no_slot' },
  ]);
});

test('planBook drops a waitlisted name that takes a skipped buy', () => {
  const extras = Array.from({ length: 16 }, (_, index) => (
    signal(`S${String(index).padStart(2, '0')}`, 1 - index * 0.01)
  ));
  const plan = planBook({
    code: 'trend',
    state: { positions: [], cooldown: [], opened: false },
    account: { positions: [], openOrders: [], equity: 5000 },
    signals: asMap(extras),
    sessions: ['2024-03-19', '2024-03-20'],
    sessionDate: '2024-03-20',
    executionDate: '2024-03-21',
    eligible: (symbol) => symbol !== 'S00',
  });
  assert.ok(names(plan, 'buy').includes('S15'));
  assert.equal(plan.waiting.find((row) => row.symbol === 'S15'), undefined);
  assert.ok(plan.skipped.some((row) => row.symbol === 'S00' && row.reason === 'no_bar_on_execution_session'));
});

function dipSignal(symbol, momentum, extras = {}) {
  return signal(symbol, momentum, {
    dipSetup: extras.dipSetup ?? true,
    sma20: extras.sma20 ?? 22,
    close: extras.close ?? 20,
    ...extras,
  });
}

test('a leftover cash hole does not block a paired Dip swap', () => {
  const sessions = ['2026-10-14', '2026-10-15', '2026-10-16'];
  const held = [
    { symbol: 'SNDK', slotKind: 'signal', entrySession: '2026-10-13', dipEntrySession: '2026-10-13', fallbackRank: null },
    { symbol: 'HPQ', slotKind: 'signal', entrySession: '2026-10-13', dipEntrySession: '2026-10-13', fallbackRank: null },
    { symbol: 'HOOD', slotKind: 'signal', entrySession: '2026-10-13', dipEntrySession: '2026-10-13', fallbackRank: null },
    { symbol: 'IBKR', slotKind: 'signal', entrySession: '2026-10-13', dipEntrySession: '2026-10-13', fallbackRank: null },
    { symbol: 'NVDA', slotKind: 'signal', entrySession: '2026-10-13', dipEntrySession: '2026-10-13', fallbackRank: null },
    { symbol: 'DE', slotKind: 'signal', entrySession: '2026-10-13', dipEntrySession: '2026-10-13', fallbackRank: null },
    { symbol: 'DELL', slotKind: 'signal', entrySession: '2026-10-16', dipEntrySession: '2026-10-16', fallbackRank: null },
    { symbol: 'RACE', slotKind: 'signal', entrySession: '2026-10-13', dipEntrySession: '2026-10-13', fallbackRank: null },
    { symbol: 'GRMN', slotKind: 'signal', entrySession: '2026-10-13', dipEntrySession: '2026-10-13', fallbackRank: null },
    { symbol: 'AAPL', slotKind: 'fallback', entrySession: '2026-10-13', dipEntrySession: null, fallbackRank: 3 },
  ];
  const today = [
    dipSignal('SNDK', 1.14),
    dipSignal('HPQ', 0.94),
    dipSignal('HOOD', 0.47),
    dipSignal('IBKR', 0.29),
    dipSignal('NVDA', 0.22),
    dipSignal('DE', 0.21),
    dipSignal('DELL', 2.96),
    dipSignal('RACE', 0.26, { dipSetup: false, close: 397.53, sma20: 396.63 }),
    dipSignal('GRMN', 0.2, { dipSetup: false, close: 284.79, sma20: 282.35 }),
    dipSignal('AAPL', 0.35, { dipSetup: false, close: 343.46, sma20: 337.42 }),
    dipSignal('DDOG', 0.8, { close: 247.11, sma20: 269.01 }),
  ];
  const yesterday = [
    dipSignal('DDOG', 0.79, { date: '2026-10-15' }),
    dipSignal('RACE', 0.24, { date: '2026-10-15', dipSetup: false, close: 398.24, sma20: 397.09 }),
    dipSignal('GRMN', 0.19, { date: '2026-10-15', dipSetup: false, close: 285.22, sma20: 281.82 }),
  ];
  const cash = -11.3;
  const positionValue = 5000;
  const account = {
    cash,
    equity: positionValue + cash,
    openOrders: [],
    positions: held.map((row) => ({
      symbol: row.symbol,
      qty: row.symbol === 'AAPL' ? '1.449246' : '1',
      market_value: 500,
    })),
  };
  const plan = planBook({
    code: 'dip',
    state: { positions: held, cooldown: [], opened: true },
    account,
    signals: asMap(today),
    priorSignals: asMap(yesterday),
    sessions,
    sessionDate: '2026-10-16',
    executionDate: '2026-10-17',
    eligible: () => true,
  });
  assert.equal(plan.ok, true);
  assert.deepEqual(names(plan, 'sell'), ['AAPL']);
  assert.deepEqual(names(plan, 'buy'), ['DDOG']);
  const proceeds = floorCents(1.449246 * 343.46 * (1 - COST_RATE));
  const dog = plan.orders.find((order) => order.symbol === 'DDOG');
  assert.equal(dog.notional, floorCents(proceeds + cash));
  assert.ok(dog.notional < proceeds);
  const apple = plan.orders.find((order) => order.symbol === 'AAPL');
  assert.equal(checkExposure({
    equity: account.equity,
    positionValue,
    buyNotional: dog.notional,
    sellNotional: apple.estimatedProceeds,
  }).ok, true);
});

test('an unpaired Dip buy that no longer fits leftover cash is skipped', () => {
  const sessions = ['2026-10-14', '2026-10-15', '2026-10-16'];
  const held = [
    { symbol: 'SNDK', slotKind: 'signal', entrySession: '2026-10-13', dipEntrySession: '2026-10-13', fallbackRank: null },
    { symbol: 'HPQ', slotKind: 'signal', entrySession: '2026-10-13', dipEntrySession: '2026-10-13', fallbackRank: null },
    { symbol: 'HOOD', slotKind: 'signal', entrySession: '2026-10-13', dipEntrySession: '2026-10-13', fallbackRank: null },
    { symbol: 'IBKR', slotKind: 'signal', entrySession: '2026-10-13', dipEntrySession: '2026-10-13', fallbackRank: null },
    { symbol: 'NVDA', slotKind: 'signal', entrySession: '2026-10-13', dipEntrySession: '2026-10-13', fallbackRank: null },
    { symbol: 'DE', slotKind: 'signal', entrySession: '2026-10-13', dipEntrySession: '2026-10-13', fallbackRank: null },
    { symbol: 'DELL', slotKind: 'signal', entrySession: '2026-10-16', dipEntrySession: '2026-10-16', fallbackRank: null },
    { symbol: 'RACE', slotKind: 'signal', entrySession: '2026-10-13', dipEntrySession: '2026-10-13', fallbackRank: null },
    { symbol: 'GRMN', slotKind: 'signal', entrySession: '2026-10-13', dipEntrySession: '2026-10-13', fallbackRank: null },
  ];
  const today = held.map((row) => dipSignal(row.symbol, 0.2)).concat([
    dipSignal('DDOG', 0.8),
  ]);
  const plan = planBook({
    code: 'dip',
    state: { positions: held, cooldown: [], opened: true },
    account: {
      cash: 0.4,
      equity: 5000,
      openOrders: [],
      positions: held.map((row) => ({ symbol: row.symbol, qty: '1', market_value: 555 })),
    },
    signals: asMap(today),
    priorSignals: asMap([dipSignal('DDOG', 0.7, { date: '2026-10-15' })]),
    sessions,
    sessionDate: '2026-10-16',
    executionDate: '2026-10-17',
    eligible: () => true,
  });
  assert.equal(plan.ok, true);
  assert.deepEqual(names(plan, 'buy'), []);
  assert.ok(plan.skipped.some((row) => row.symbol === 'DDOG' && row.reason === 'below_min_notional'));
});
