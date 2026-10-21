import assert from 'node:assert/strict';
import test from 'node:test';
import { dipExit } from '../lib/signals.js';

test('dip exits on a broken trend or a repaired close, not on a clock', () => {
  assert.equal(dipExit({ close: 8, sma200: 9, sma20: 7 }), 'trend_broken');
  assert.equal(dipExit({ close: 12, sma200: 9, sma20: 11 }), 'dip_repaired');
  assert.equal(dipExit({ close: 10, sma200: 9, sma20: 11 }), null);
  assert.equal(dipExit({ close: 11, sma200: 9, sma20: 11 }), null);
});
