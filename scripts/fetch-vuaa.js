import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { VUAA, VUAA_CACHE } from '../lib/config.js';
import { fetchYahooBars } from '../lib/yahoo.js';

const fetched = await fetchYahooBars(VUAA.yahooSymbol, {
  start: '2019-05-01',
  timeZone: 'Europe/London',
});
if (fetched.currency && fetched.currency !== 'USD') {
  console.error(`Refusing VUAA cache: currency is ${fetched.currency}, expected USD`);
  process.exit(1);
}

const cache = {
  cache_version: 1,
  source: 'yahoo-finance-chart',
  endpoint: fetched.endpoint,
  symbol: VUAA.yahooSymbol,
  ticker: VUAA.ticker,
  isin: VUAA.isin,
  name: VUAA.name,
  currency: fetched.currency || 'USD',
  feed: null,
  adjustment: 'yahoo-adjclose-scaled',
  note: 'London USD accumulating listing. Not requested from Alpaca feed=sip. Not VUAG and not SPY.',
  fetched_at: new Date().toISOString(),
  bar_count: fetched.bars.length,
  bars: fetched.bars,
};

mkdirSync(dirname(VUAA_CACHE), { recursive: true });
const temporary = `${VUAA_CACHE}.tmp`;
writeFileSync(temporary, JSON.stringify(cache));
renameSync(temporary, VUAA_CACHE);
console.log(`VUAA ${fetched.bars.length} ${fetched.bars[0]?.date} ${fetched.bars[fetched.bars.length - 1]?.date} ${fetched.currency}`);
