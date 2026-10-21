import assert from 'node:assert/strict';
import test from 'node:test';
import { assertUsCache, assertYahooUsCache, normalizeBars } from '../lib/bars.js';

test('a bar whose high misses the close is kept and the close is unchanged', () => {
  const { bars, dropped, repaired } = normalizeBars([{
    date: '2019-05-16',
    open: 50.37,
    high: 50.37,
    low: 50.37,
    close: 50.93,
    volume: 1,
  }]);
  assert.equal(dropped, 0);
  assert.equal(repaired, 1);
  assert.equal(bars[0].close, 50.93);
  assert.equal(bars[0].open, 50.37);
  assert.ok(bars[0].high >= bars[0].close);
});

test('Alpaca US cache is refused when it is not SIP adjustment=all', () => {
  assert.throws(() => assertUsCache({
    feed: null,
    adjustment: 'yahoo-adjclose-scaled',
    timeframe: '1Day',
    bars: { AAPL: [{ date: '2006-01-03' }] },
  }));
});

test('Yahoo US cache is refused when it is marked feed=sip', () => {
  assert.throws(() => assertYahooUsCache({
    source: 'yahoo-finance-chart',
    adjustment: 'yahoo-adjclose-scaled',
    feed: 'sip',
    bars: { AAPL: [{ date: '2006-01-03' }] },
  }));
});
