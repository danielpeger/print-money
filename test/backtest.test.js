import assert from 'node:assert/strict';
import test from 'node:test';
import { comparisonWindow } from '../lib/backtest.js';
import { LONG_COMPARISON_NOT_BEFORE } from '../lib/config.js';

function sessionsFrom(start, count) {
  const dates = [];
  let cursor = Date.parse(`${start}T00:00:00Z`);
  while (dates.length < count) {
    const date = new Date(cursor).toISOString().slice(0, 10);
    const day = new Date(cursor).getUTCDay();
    if (day !== 0 && day !== 6) dates.push(date);
    cursor += 86400000;
  }
  return dates;
}

test('the paper comparison cannot start before VUAA listed', () => {
  const sessions = sessionsFrom('2016-01-04', 900);
  const window = comparisonWindow(sessions, ['2019-05-16', '2026-10-12']);
  assert.equal(window.start, '2019-05-16');
  assert.ok(window.start >= '2019-05-16');
});

test('the long comparison can start in 2006 once the average is warm', () => {
  const sessions = sessionsFrom('2005-01-03', 400);
  const benchmark = sessionsFrom('1995-01-03', 3000);
  const window = comparisonWindow(sessions, benchmark, { notBefore: LONG_COMPARISON_NOT_BEFORE });
  assert.ok(window.start);
  assert.ok(window.start >= LONG_COMPARISON_NOT_BEFORE);
  assert.ok(sessions.indexOf(window.start) >= 200);
});
