import assert from 'node:assert/strict';
import test from 'node:test';
import { namedWindows } from '../lib/metrics.js';
import { EVENT_WINDOWS } from '../lib/config.js';

function curveFrom(pairs) {
  return pairs.map(([date, equity]) => ({ date, equity }));
}

test('named windows clip to the sample and keep the GFC crash', () => {
  const curve = curveFrom([
    ['2007-10-01', 100],
    ['2007-10-10', 99],
    ['2008-09-15', 70],
    ['2009-03-09', 50],
    ['2009-03-10', 51],
    ['2020-02-19', 200],
    ['2020-03-23', 140],
    ['2020-03-24', 141],
  ]);
  const rows = namedWindows(curve, 100, EVENT_WINDOWS, '2006-01-03', '2020-03-24');
  const gfc = rows.find((row) => row.id === 'gfc_crash');
  const covid = rows.find((row) => row.id === 'covid_crash');
  const pre = rows.find((row) => row.id === 'pre_gfc');
  assert.equal(gfc.overlaps, true);
  assert.equal(gfc.from, '2007-10-10');
  assert.equal(gfc.to, '2009-03-09');
  assert.ok(gfc.summary.totalReturn < 0);
  assert.equal(covid.overlaps, true);
  assert.ok(covid.summary.totalReturn < 0);
  assert.equal(pre.overlaps, true);
  assert.equal(pre.from, '2007-10-01');
});

test('a window entirely before the sample does not overlap', () => {
  const curve = curveFrom([
    ['2019-05-16', 100],
    ['2020-03-23', 80],
  ]);
  const rows = namedWindows(curve, 100, EVENT_WINDOWS, '2019-05-16', '2020-03-23');
  const gfc = rows.find((row) => row.id === 'gfc_crash');
  const covid = rows.find((row) => row.id === 'covid_crash');
  assert.equal(gfc.overlaps, false);
  assert.equal(covid.overlaps, true);
});
