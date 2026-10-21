import assert from 'node:assert/strict';
import test from 'node:test';
import { BASKET } from '../lib/config.js';
import { indexBars } from '../lib/bars.js';
import { buildSignalMaps, priorSignalsForDate, signalsForDate, simulateActive } from '../lib/simulate.js';

function sessionsOf(count) {
  const dates = [];
  let cursor = Date.parse('2016-01-04T00:00:00Z');
  while (dates.length < count) {
    const date = new Date(cursor);
    const day = date.getUTCDay();
    if (day !== 0 && day !== 6) dates.push(date.toISOString().slice(0, 10));
    cursor += 86400000;
  }
  return dates;
}

test('the opening fill uses the next open and ignores that session close', () => {
  const sessions = sessionsOf(210);
  const bars = sessions.map((date, index) => {
    let close = 100;
    if (index === 178) close = 120;
    if (index === 199) close = 110;
    if (index >= 200) close = 500;
    return {
      date,
      open: index === 200 ? 80 : close,
      high: Math.max(close, index === 200 ? 80 : close),
      low: Math.min(close, index === 200 ? 80 : close),
      close,
      volume: 1_000_000,
    };
  });
  const indexes = new Map(BASKET.map((symbol) => [symbol, indexBars(symbol === 'AAPL' ? bars : [])]));
  const signalMaps = buildSignalMaps({ AAPL: bars });
  const result = simulateActive({
    bookName: 'trend',
    sessions,
    indexes,
    signalMaps,
    comparisonStart: sessions[200],
    comparisonEnd: sessions[200],
    costRate: 0,
    capital: 5000,
  });
  assert.equal(result.ok, true);
  const aapl = result.holdings.find((row) => row.symbol === 'AAPL');
  assert.ok(aapl);
  assert.ok(Math.abs(aapl.shares - (333.33 / 80)) < 1e-6);
  const expected = 5000 - 333.33 + (333.33 / 80) * 500;
  assert.ok(Math.abs(result.curve[0].equity - expected) < 0.02);
});

test('priorSignalsForDate is the previous session, and null on the first session', () => {
  const maps = new Map([
    ['AAA', new Map([
      ['2024-03-19', { symbol: 'AAA', date: '2024-03-19', trendQualifier: false }],
      ['2024-03-20', { symbol: 'AAA', date: '2024-03-20', trendQualifier: false }],
    ])],
  ]);
  const sessions = ['2024-03-19', '2024-03-20'];
  const prior = priorSignalsForDate(maps, sessions, '2024-03-20');
  assert.equal(prior.get('AAA').date, '2024-03-19');
  assert.equal(prior.get('AAA').trendQualifier, false);
  assert.equal(signalsForDate(maps, '2024-03-20').get('AAA').date, '2024-03-20');
  assert.equal(priorSignalsForDate(maps, sessions, '2024-03-19'), null);
  assert.equal(priorSignalsForDate(maps, sessions, '2024-03-21'), null);
});
