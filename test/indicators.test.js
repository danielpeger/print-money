import assert from 'node:assert/strict';
import test from 'node:test';
import { momentumAt, signalAt, signalSeries, smaAt } from '../lib/indicators.js';

function closes(n, value = 100) {
  return Array.from({ length: n }, () => value);
}

test('sma uses only the last period closes', () => {
  const series = closes(10, 1);
  series[9] = 11;
  assert.equal(smaAt(series, 9, 10), 2);
  assert.equal(smaAt(series, 8, 10), null);
});

test('momentum is the 126-day return ending 21 days ago', () => {
  const series = closes(200, 10);
  series[178] = 12;
  series[52] = 8;
  assert.equal(momentumAt(series, 199, 126, 21), 12 / 8 - 1);
});

test('a later close does not change an earlier signal', () => {
  const bars = closes(210, 10).map((close, index) => ({
    date: `2020-01-${String(index + 1).padStart(2, '0')}`,
    close,
    symbol: 'AAA',
  }));
  bars[188].close = 12;
  bars[209].close = 11;
  const future = bars.map((bar) => ({ ...bar }));
  future[209] = { ...future[209], close: 1000 };
  const left = signalAt(bars.map((bar) => bar.close), 208);
  const right = signalAt(future.map((bar) => bar.close), 208);
  assert.deepEqual(left, right);
  const series = signalSeries(bars);
  assert.equal(series[209].close, 11);
  assert.notEqual(series[208].close, series[209].close);
});

test('trend qualifier requires a close above the long average and positive momentum', () => {
  const series = closes(200, 10);
  series[199] = 12;
  series[178] = 12;
  const signal = signalAt(series, 199);
  assert.equal(signal.trendQualifier, true);
  series[178] = 10;
  assert.equal(signalAt(series, 199).trendQualifier, false);
});
