import assert from 'node:assert/strict';
import test from 'node:test';
import { reasonFor } from '../lib/reasons.js';
import { spreadCost, spreadCostMatches } from '../lib/spread.js';
import { capBuysToCash } from '../lib/plan-book.js';
import { assertPaperEnv, checkExposure, inferredCash } from '../lib/risk.js';
import { clientOrderId, submitIntents } from '../lib/orders.js';

test('the same inputs produce the same reason', () => {
  const order = {
    book: 'trend',
    symbol: 'AAPL',
    side: 'buy',
    slotKind: 'signal',
    opening: true,
    close: 225.5,
    sma200: 210.25,
    momentum: 0.152,
    rank: 3,
  };
  assert.equal(reasonFor(order), reasonFor({ ...order }));
  assert.match(reasonFor(order), /start session/);
  assert.match(reasonFor(order), /200-day SMA 210.25/);
  assert.match(reasonFor(order), /positive at 15.2%/);
  assert.match(reasonFor(order), /ranks it 3/);
});

test('sell reasons name the rule that fired', () => {
  const dip = reasonFor({
    book: 'dip',
    symbol: 'AAPL',
    side: 'sell',
    exitRule: 'dip_repaired',
    close: 210,
    sma20: 205,
    holdingSessions: 8,
    pairedSymbol: 'NVDA',
  });
  assert.match(dip, /back above the 20-day SMA/);
  assert.match(dip, /stronger 12-to-1 momentum/);
  assert.match(dip, /8 sessions/);
  const trend = reasonFor({
    book: 'trend',
    symbol: 'AAPL',
    side: 'sell',
    slotKind: 'signal',
    close: 180,
    sma200: 190,
    momentum: -0.031,
    holdingSessions: 40,
    pairedSymbol: 'NVDA',
  });
  assert.match(trend, /no longer qualifies for Trend/);
  assert.match(trend, /not above the 200-day SMA/);
  assert.match(trend, /new trend with stronger 12-to-1 momentum needs the slot/);
  assert.match(trend, /funds the buy of NVDA/);
  assert.match(trend, /40 sessions/);
  assert.match(trend, /stronger 12-to-1 momentum/);
  assert.match(trend, /oldest weaker Trend holding/);
  assert.match(trend, /already failed on the prior session/);
});

test('spread cost matches the side formula and rejects a wrong stored value', () => {
  assert.equal(spreadCost({ side: 'buy', shares: 2, fillPrice: 11, bid: 10, ask: 11 }), 1);
  assert.equal(spreadCost({ side: 'sell', shares: 2, fillPrice: 10, bid: 10, ask: 11 }), 1);
  const quote = { bid: 10, ask: 11 };
  assert.equal(spreadCostMatches({ side: 'buy', shares: 2, fillPrice: 11, spreadCostUsd: 1 }, quote), true);
  assert.equal(spreadCostMatches({ side: 'buy', shares: 2, fillPrice: 11, spreadCostUsd: 5 }, quote), false);
});

test('exposure and a live host fail closed', () => {
  assert.equal(checkExposure({ equity: 100, positionValue: 80, buyNotional: 30, sellNotional: 10 }).ok, true);
  assert.equal(checkExposure({ equity: 100, positionValue: 80, buyNotional: 30, sellNotional: 0 }).ok, false);
  assert.equal(checkExposure({ equity: 98.7, positionValue: 110, buyNotional: 0, sellNotional: 0 }).ok, true);
  assert.equal(checkExposure({ equity: 98.7, positionValue: 110, buyNotional: 40, sellNotional: 40 }).ok, true);
  assert.equal(checkExposure({ equity: 98.7, positionValue: 110, buyNotional: 40, sellNotional: 0 }).ok, false);
  assert.throws(() => assertPaperEnv({
    APCA_API_BASE_URL: 'https://api.alpaca.markets',
    APCA_API_KEY_ID_TREND: 'x',
    APCA_API_SECRET_KEY_TREND: 'x',
    APCA_API_KEY_ID_DIP: 'x',
    APCA_API_SECRET_KEY_DIP: 'x',
    APCA_API_KEY_ID_CONTROL: 'x',
    APCA_API_SECRET_KEY_CONTROL: 'x',
    LIVE_TRADING_APPROVED: 'yes',
  }), /paper/);
});

test('a leftover cash hole still funds a paired buy from the sale, not the hole', () => {
  const capped = capBuysToCash(
    [{ symbol: 'DDOG', side: 'buy', notional: 464.82 }],
    -11.3,
    464.82,
  );
  assert.equal(capped.buys[0].notional, 453.52);
  assert.deepEqual(capped.skipped, []);
});

test('cash too small for a live buy becomes a skip, not a failed run', () => {
  const capped = capBuysToCash(
    [{ symbol: 'DDOG', side: 'buy', notional: 500 }],
    0.4,
    0,
  );
  assert.deepEqual(capped.buys, []);
  assert.deepEqual(capped.skipped, [{ symbol: 'DDOG', side: 'buy', reason: 'below_min_notional' }]);
});

test('missing broker cash is inferred from equity minus marked positions', () => {
  assert.equal(inferredCash({ equity: 5000, positions: [] }), 5000);
  assert.equal(inferredCash({
    equity: 4988.7,
    positions: [{ market_value: 2500 }, { market_value: 2500 }],
  }), 4988.7 - 5000);
  assert.equal(inferredCash({ cash: -11.3, equity: 4988.7, positions: [{ market_value: 5000 }] }), -11.3);
});

test('a second submit finds the client order and does not post it again', async () => {
  const intent = {
    book: 'trend',
    executionDate: '2026-10-13',
    symbol: 'BRK.B',
    side: 'buy',
    clientOrderId: clientOrderId({ book: 'trend', executionDate: '2026-10-13', symbol: 'BRK.B', side: 'buy' }),
  };
  assert.equal(intent.clientOrderId, 't-20261013-BRK_B-buy');
  assert.ok(intent.clientOrderId.length <= 48);
  const seen = new Map();
  let posts = 0;
  const broker = {
    async findByClientOrderId(id) {
      return seen.get(id) || null;
    },
    async submit(row) {
      posts += 1;
      const created = { id: 'broker-1', status: 'accepted' };
      seen.set(row.clientOrderId, created);
      return created;
    },
  };
  await submitIntents([intent], broker);
  await submitIntents([intent], broker);
  assert.equal(posts, 1);
});
