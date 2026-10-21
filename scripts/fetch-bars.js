import { loadEnv } from '../lib/env.js';
import { nyDateFromIso } from '../lib/calendar.js';
import { BASKET, US_CACHE } from '../lib/config.js';
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

loadEnv();

const KEY = process.env.APCA_API_KEY_ID_TREND;
const SECRET = process.env.APCA_API_SECRET_KEY_TREND;
if (!KEY || !SECRET) {
  console.error('Missing APCA_API_KEY_ID_TREND or APCA_API_SECRET_KEY_TREND');
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const RANGE_END = new Date(Date.now() - 20 * 60 * 1000).toISOString();

async function requestBars(symbols, pageToken) {
  const params = new URLSearchParams({
    symbols: symbols.join(','),
    timeframe: '1Day',
    start: '2016-01-01',
    end: RANGE_END,
    limit: '10000',
    adjustment: 'all',
    feed: 'sip',
  });
  if (pageToken) params.set('page_token', pageToken);
  const response = await fetch(`https://data.alpaca.markets/v2/stocks/bars?${params}`, {
    headers: {
      'APCA-API-KEY-ID': KEY,
      'APCA-API-SECRET-KEY': SECRET,
    },
    signal: AbortSignal.timeout(30000),
  });
  if (response.status === 429) return { retry: true };
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Alpaca bars ${response.status}: ${text.slice(0, 200)}`);
  }
  return response.json();
}

async function fetchSymbols(symbols) {
  const collected = new Map(symbols.map((symbol) => [symbol, []]));
  let pageToken = null;
  let pages = 0;
  do {
    const body = await requestBars(symbols, pageToken);
    if (body.retry) {
      await sleep(1000);
      continue;
    }
    pages += 1;
    for (const [symbol, rows] of Object.entries(body.bars || {})) {
      const list = collected.get(symbol);
      if (!list) continue;
      for (const row of rows) {
        list.push({
          date: nyDateFromIso(row.t),
          open: row.o,
          high: row.h,
          low: row.l,
          close: row.c,
          volume: row.v,
        });
      }
    }
    pageToken = body.next_page_token || null;
  } while (pageToken);
  return { collected, pages };
}

const chunks = [];
for (let i = 0; i < BASKET.length; i += 5) chunks.push(BASKET.slice(i, i + 5));

const bars = {};
let pages = 0;
for (const chunk of chunks) {
  const result = await fetchSymbols(chunk);
  pages += result.pages;
  for (const [symbol, rows] of result.collected) bars[symbol] = rows;
  console.log(`fetched ${chunk.join(',')} (${pages} pages)`);
}

const cache = {
  cache_version: 1,
  source: 'alpaca',
  endpoint: 'https://data.alpaca.markets/v2/stocks/bars',
  feed: 'sip',
  adjustment: 'all',
  timeframe: '1Day',
  start: '2016-01-01',
  end: RANGE_END,
  fetched_at: new Date().toISOString(),
  symbols: [...BASKET],
  bars,
};

mkdirSync(dirname(US_CACHE), { recursive: true });
const temporary = `${US_CACHE}.tmp`;
writeFileSync(temporary, JSON.stringify(cache));
renameSync(temporary, US_CACHE);

for (const symbol of BASKET) {
  const rows = bars[symbol] || [];
  const first = rows[0]?.date || 'none';
  const last = rows[rows.length - 1]?.date || 'none';
  console.log(`${symbol} ${rows.length} ${first} ${last}`);
}
