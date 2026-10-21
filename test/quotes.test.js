import assert from 'node:assert/strict';
import test from 'node:test';
import { selectOpeningQuote } from '../lib/alpaca.js';

test('the opening quote is the earliest SIP quote in the first minute', () => {
  const chosen = selectOpeningQuote([
    { t: '2026-10-12T13:29:59.000Z', bp: 10, ap: 11, bs: 1, as: 1 },
    { t: '2026-10-12T13:30:05.000Z', bp: 10, ap: 10.2, bs: 3, as: 4 },
    { t: '2026-10-12T13:30:40.000Z', bp: 9, ap: 9.1, bs: 1, as: 1 },
    { t: '2026-10-12T13:31:00.000Z', bp: 8, ap: 8.1, bs: 1, as: 1 },
  ], '2026-10-12');
  assert.equal(chosen.quote_at, '2026-10-12T13:30:05.000Z');
  assert.equal(chosen.bid, 10);
  assert.equal(chosen.ask, 10.2);
});
