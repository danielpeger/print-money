import assert from 'node:assert/strict';
import test from 'node:test';
import {
  adoptBrokerHoldings,
  applyFilledBuy,
  brokerClass,
  latestAdoptiveBuy,
  recordedIntentStatus,
  unexpectedMessage,
  unexpectedSymbols,
} from '../lib/holdings.js';
import { planBook } from '../lib/plan-book.js';

function buyIntent(symbol, extras = {}) {
  return {
    id: extras.id || 1,
    symbol,
    side: 'buy',
    status: extras.status || 'already_present',
    slot_kind: extras.slot_kind || 'signal',
    session_date: extras.session_date || '2026-10-13',
    fallback_rank: extras.fallback_rank ?? null,
    client_order_id: extras.client_order_id || `t-20261013-${symbol}-buy`,
    filled_qty: extras.filled_qty ?? null,
  };
}

test('already_present is recorded as submitted so the next run still reconciles it', () => {
  assert.equal(recordedIntentStatus('already_present'), 'submitted');
  assert.equal(recordedIntentStatus('accepted'), 'accepted');
});

test('brokerClass treats pending_new as open', () => {
  assert.equal(brokerClass({ status: 'pending_new', filled_qty: '0' }), 'open');
  assert.equal(brokerClass({ status: 'filled', filled_qty: '1.5' }), 'filled');
});

test('a same-day rerun does not re-buy while opening orders are still at the broker', () => {
  const plan = planBook({
    code: 'trend',
    state: { positions: [], cooldown: [], opened: true },
    account: { positions: [], openOrders: [{ symbol: 'AAPL' }], equity: 5000 },
    signals: new Map(),
    sessions: ['2026-10-12'],
    sessionDate: '2026-10-12',
    executionDate: '2026-10-13',
    eligible: () => true,
  });
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.orders, []);
  assert.equal(plan.skipped[0].reason, 'opening_in_flight');
});

test('planBook lists every unexpected broker lot, not only the first', () => {
  const plan = planBook({
    code: 'trend',
    state: { positions: [], cooldown: [], opened: true },
    account: {
      positions: [{ symbol: 'AAPL', qty: '1' }, { symbol: 'NVDA', qty: '1' }],
      openOrders: [],
      equity: 5000,
    },
    signals: new Map(),
    sessions: ['2026-10-13'],
    sessionDate: '2026-10-13',
    executionDate: '2026-10-14',
    eligible: () => true,
  });
  assert.equal(plan.ok, false);
  assert.equal(plan.blocked, 'unexpected_position');
  assert.deepEqual(plan.symbols, ['AAPL', 'NVDA']);
  assert.equal(unexpectedMessage('trend', plan.symbols), 'unexpected_position AAPL,NVDA (trend)');
});

test('Trend opening buys with already_present status are adopted from their intents', () => {
  const state = { positions: [], cooldown: [], opened: true };
  const brokerPositions = [{ symbol: 'AAPL', qty: '0.9' }, { symbol: 'NVDA', qty: '1.4' }];
  const intents = [
    buyIntent('AAPL', { id: 8, slot_kind: 'signal' }),
    buyIntent('NVDA', { id: 13, slot_kind: 'signal' }),
  ];
  const result = adoptBrokerHoldings({ brokerPositions, state, intents, code: 'trend' });
  assert.deepEqual(result.unexpected, []);
  assert.equal(state.positions.length, 2);
  const aapl = state.positions.find((row) => row.symbol === 'AAPL');
  assert.equal(aapl.slotKind, 'signal');
  assert.equal(aapl.entrySession, '2026-10-13');
  assert.equal(aapl.dipEntrySession, null);
});

test('Dip fallback AAPL is adopted with its fallback rank', () => {
  const state = { positions: [], cooldown: [], opened: true };
  const result = adoptBrokerHoldings({
    brokerPositions: [{ symbol: 'AAPL', qty: '1' }],
    state,
    intents: [buyIntent('AAPL', { slot_kind: 'fallback', fallback_rank: 3, client_order_id: 'd-20261013-AAPL-buy' })],
    code: 'dip',
  });
  assert.deepEqual(result.unexpected, []);
  assert.equal(state.positions[0].slotKind, 'fallback');
  assert.equal(state.positions[0].fallbackRank, 3);
  assert.equal(state.positions[0].dipEntrySession, null);
});

test('a broker lot with no matching buy intent stays unexpected and is not sold', () => {
  const state = { positions: [], cooldown: [], opened: true };
  const result = adoptBrokerHoldings({
    brokerPositions: [{ symbol: 'TSLA', qty: '2' }],
    state,
    intents: [buyIntent('AAPL')],
    code: 'trend',
  });
  assert.deepEqual(result.unexpected, ['TSLA']);
  assert.deepEqual(result.adopted, []);
  assert.deepEqual(state.positions, []);
});

test('a later filled sell clears the adoptive buy', () => {
  const intents = [
    buyIntent('AAPL', { id: 1, session_date: '2026-10-13' }),
    {
      id: 2,
      symbol: 'AAPL',
      side: 'sell',
      status: 'filled',
      session_date: '2026-10-14',
      filled_qty: '0.9',
      client_order_id: 't-20261014-AAPL-sell',
    },
  ];
  assert.equal(latestAdoptiveBuy(intents, 'AAPL'), null);
});

test('applyFilledBuy replaces an existing row instead of duplicating it', () => {
  const state = { positions: [{ symbol: 'AAPL', slotKind: 'fallback', entrySession: '2026-10-13' }], opened: true };
  applyFilledBuy(state, buyIntent('AAPL', { slot_kind: 'signal' }), 'trend');
  assert.equal(state.positions.length, 1);
  assert.equal(state.positions[0].slotKind, 'signal');
});

test('ghost book_state rows the broker no longer holds are dropped', () => {
  const state = {
    positions: [{ symbol: 'AAPL', slotKind: 'signal', entrySession: '2026-10-13' }],
    opened: true,
  };
  const result = adoptBrokerHoldings({
    brokerPositions: [{ symbol: 'NVDA', qty: '1' }],
    state,
    intents: [buyIntent('NVDA')],
    code: 'trend',
  });
  assert.deepEqual(result.unexpected, []);
  assert.deepEqual(state.positions.map((row) => row.symbol), ['NVDA']);
});

test('after adopting the Trend opening lots, planBook is no longer blocked', () => {
  const state = { positions: [], cooldown: [], opened: true };
  const brokerPositions = [{ symbol: 'AAPL', qty: '1' }];
  adoptBrokerHoldings({
    brokerPositions,
    state,
    intents: [buyIntent('AAPL')],
    code: 'trend',
  });
  const aapl = {
    symbol: 'AAPL',
    date: '2026-10-13',
    close: 340.97,
    sma200: 290.75,
    sma20: 330,
    momentum: 0.301,
    warmed: true,
    trendQualifier: true,
    dipSetup: false,
  };
  const plan = planBook({
    code: 'trend',
    state,
    account: { positions: brokerPositions, openOrders: [], equity: 5000 },
    signals: new Map([['AAPL', aapl]]),
    sessions: ['2026-10-12', '2026-10-13'],
    sessionDate: '2026-10-13',
    executionDate: '2026-10-14',
    eligible: (symbol) => symbol === 'AAPL',
  });
  assert.equal(plan.ok, true);
  assert.equal(plan.orders.some((order) => order.symbol === 'AAPL' && order.side === 'sell'), false);
});

test('unexpectedSymbols is empty when every broker lot has metadata', () => {
  assert.deepEqual(
    unexpectedSymbols(
      [{ symbol: 'AAPL' }],
      [{ symbol: 'AAPL', slotKind: 'signal', entrySession: '2026-10-13' }],
    ),
    [],
  );
});
