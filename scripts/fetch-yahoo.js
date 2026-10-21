import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  BASKET,
  LONG_HISTORY_START,
  US_YAHOO_CACHE,
  VFINX,
  VFINX_CACHE,
  YAHOO_CHART_ENDPOINT,
  yahooSymbolFor,
} from '../lib/config.js';
import { fetchYahooBars, fetchYahooBasket } from '../lib/yahoo.js';

function writeAtomic(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  writeFileSync(temporary, JSON.stringify(value));
  renameSync(temporary, path);
}

const start = LONG_HISTORY_START;
const fetchedAt = new Date().toISOString();
const yahooSymbols = Object.fromEntries(BASKET.map((symbol) => [symbol, yahooSymbolFor(symbol)]));

console.log(`fetching Yahoo basket from ${start}`);
const { bars, meta } = await fetchYahooBasket(BASKET, { start });

const usCache = {
  cache_version: 1,
  source: 'yahoo-finance-chart',
  endpoint: YAHOO_CHART_ENDPOINT,
  feed: null,
  adjustment: 'yahoo-adjclose-scaled',
  timeframe: '1Day',
  start,
  end: fetchedAt,
  fetched_at: fetchedAt,
  symbols: [...BASKET],
  yahoo_symbols: yahooSymbols,
  symbol_meta: meta,
  bars,
};
writeAtomic(US_YAHOO_CACHE, usCache);

const vfinx = await fetchYahooBars(VFINX.yahooSymbol, { start });
if (vfinx.currency && vfinx.currency !== 'USD') {
  console.error(`Refusing VFINX cache: currency is ${vfinx.currency}, expected USD`);
  process.exit(1);
}

const vfinxCache = {
  cache_version: 1,
  source: 'yahoo-finance-chart',
  endpoint: vfinx.endpoint,
  symbol: VFINX.yahooSymbol,
  ticker: VFINX.ticker,
  name: vfinx.name || VFINX.name,
  currency: vfinx.currency || 'USD',
  feed: null,
  adjustment: 'yahoo-adjclose-scaled',
  note: 'Vanguard 500 Index Investor. Yahoo adjclose includes dividend reinvestment. Used only on the long Yahoo sample. Not VUAA and not SPY.',
  fetched_at: fetchedAt,
  bar_count: vfinx.bars.length,
  bars: vfinx.bars,
};
writeAtomic(VFINX_CACHE, vfinxCache);

console.log(`wrote ${US_YAHOO_CACHE}`);
console.log(`VFINX ${vfinx.bars.length} ${vfinx.bars[0]?.date} ${vfinx.bars[vfinx.bars.length - 1]?.date} ${vfinx.currency}`);
