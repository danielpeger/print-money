import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  assertUsCache,
  assertVfinxCache,
  assertVuaaCache,
  assertYahooUsCache,
  normalizeBars,
  readJson,
} from '../lib/bars.js';
import { runResearch } from '../lib/backtest.js';
import {
  BASKET,
  LONG_COMPARISON_NOT_BEFORE,
  LONG_EQUITY_PATH,
  REPORT_PATH,
  US_CACHE,
  US_YAHOO_CACHE,
  VFINX_CACHE,
  VUAA_CACHE,
} from '../lib/config.js';
import { renderCombinedReport, renderEquityCsv, renderReport } from '../lib/report.js';

function loadBars(cache, symbols) {
  const usBars = {};
  let dropped = 0;
  let repaired = 0;
  for (const symbol of symbols) {
    const normalized = normalizeBars(cache.bars[symbol] || []);
    dropped += normalized.dropped;
    repaired += normalized.repaired;
    usBars[symbol] = normalized.bars;
  }
  return { usBars, dropped, repaired };
}

function loadBenchmark(cache) {
  const normalized = normalizeBars(cache.bars);
  return {
    bars: normalized.bars,
    repaired: normalized.repaired,
    dropped: normalized.dropped,
  };
}

const us = readJson(US_CACHE);
const vuaa = readJson(VUAA_CACHE);
assertUsCache(us);
assertVuaaCache(vuaa);

const usLoaded = loadBars(us, BASKET);
if (usLoaded.dropped) console.log(`dropped ${usLoaded.dropped} invalid US bars`);
const vuaaNorm = loadBenchmark(vuaa);
const paper = runResearch({
  usBars: usLoaded.usBars,
  vuaaBars: vuaaNorm.bars,
  usMeta: { ...us, dropped: usLoaded.dropped, repaired: usLoaded.repaired },
  vuaaMeta: { ...vuaa, repaired: vuaaNorm.repaired, dropped: vuaaNorm.dropped },
});

let longSample = null;
if (existsSync(US_YAHOO_CACHE) && existsSync(VFINX_CACHE)) {
  const yahoo = readJson(US_YAHOO_CACHE);
  const vfinx = readJson(VFINX_CACHE);
  assertYahooUsCache(yahoo);
  assertVfinxCache(vfinx);
  const yahooLoaded = loadBars(yahoo, BASKET);
  if (yahooLoaded.dropped) console.log(`dropped ${yahooLoaded.dropped} invalid Yahoo US bars`);
  const vfinxNorm = loadBenchmark(vfinx);
  longSample = runResearch({
    usBars: yahooLoaded.usBars,
    vuaaBars: vfinxNorm.bars,
    usMeta: { ...yahoo, dropped: yahooLoaded.dropped, repaired: yahooLoaded.repaired },
    vuaaMeta: { ...vfinx, repaired: vfinxNorm.repaired, dropped: vfinxNorm.dropped },
    notBefore: LONG_COMPARISON_NOT_BEFORE,
    benchmarkName: 'VFINX',
    sample: 'yahoo-long',
  });
} else {
  console.log('skipping long Yahoo sample; run npm run fetch-yahoo');
}

mkdirSync(dirname(REPORT_PATH), { recursive: true });
writeFileSync(REPORT_PATH, longSample ? renderCombinedReport(paper, longSample) : renderReport(paper));
writeFileSync('reports/equity.csv', renderEquityCsv(paper.curves));
if (longSample) {
  writeFileSync(LONG_EQUITY_PATH, renderEquityCsv(longSample.curves, [
    ['trend', 'Trend'],
    ['dip', 'Dip'],
    ['control', 'Control'],
    ['vfinx', 'VFINX'],
  ]));
}

const trend = paper.oosRows.find((entry) => entry.name === 'Trend');
const dip = paper.oosRows.find((entry) => entry.name === 'Dip');
console.log(`wrote ${REPORT_PATH}`);
console.log(`comparison ${paper.comparisonStart} ${paper.comparisonEnd} sessions ${paper.sessions}`);
console.log(`Trend selection ${trend.selection} market ${trend.market}`);
console.log(`Dip selection ${dip.selection} market ${dip.market}`);
if (longSample) {
  console.log(`long ${longSample.comparisonStart} ${longSample.comparisonEnd} sessions ${longSample.sessions}`);
  const gfc = longSample.events.Trend.find((entry) => entry.id === 'gfc_crash');
  const covid = longSample.events.Trend.find((entry) => entry.id === 'covid_crash');
  console.log(`GFC trend ${gfc?.summary ? (gfc.summary.totalReturn * 100).toFixed(2) + '%' : 'n/a'}`);
  console.log(`COVID trend ${covid?.summary ? (covid.summary.totalReturn * 100).toFixed(2) + '%' : 'n/a'}`);
}
