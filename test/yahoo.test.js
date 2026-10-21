import assert from 'node:assert/strict';
import test from 'node:test';
import { yahooSymbolFor } from '../lib/config.js';
import { chartDate, scaleYahooBars } from '../lib/yahoo.js';

test('Yahoo stores BRK.B under the basket name and requests BRK-B', () => {
  assert.equal(yahooSymbolFor('BRK.B'), 'BRK-B');
  assert.equal(yahooSymbolFor('AAPL'), 'AAPL');
});

test('adjclose scales the open so a dividend stays inside the price', () => {
  const scaled = scaleYahooBars({
    timestamp: [1230854400],
    meta: { currency: 'USD' },
    indicators: {
      quote: [{ open: [100], high: [110], low: [90], close: [100], volume: [1] }],
      adjclose: [{ adjclose: [50] }],
    },
  });
  assert.equal(scaled.bars.length, 1);
  assert.equal(scaled.bars[0].close, 50);
  assert.equal(scaled.bars[0].open, 50);
  assert.equal(scaled.bars[0].high, 55);
  assert.equal(scaled.bars[0].low, 45);
});

test('a Yahoo bar with a missing close is skipped', () => {
  const scaled = scaleYahooBars({
    timestamp: [1230854400, 1230940800],
    indicators: {
      quote: [{
        open: [100, 101],
        high: [100, 101],
        low: [100, 101],
        close: [100, null],
        volume: [1, 1],
      }],
      adjclose: [{ adjclose: [100, 101] }],
    },
  });
  assert.equal(scaled.skipped, 1);
  assert.equal(scaled.bars.length, 1);
  assert.equal(scaled.bars[0].close, 100);
});

test('US chart timestamps are New York session dates', () => {
  assert.equal(chartDate(1221485400), '2008-09-15');
});
