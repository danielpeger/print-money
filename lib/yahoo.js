import { nyParts } from './calendar.js';
import { YAHOO_CHART_ENDPOINT, yahooSymbolFor } from './config.js';

const USER_AGENT = 'Mozilla/5.0 (compatible; print-money/1.0; research cache)';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function chartDate(epochSeconds, timeZone = 'America/New_York') {
  return nyParts(new Date(epochSeconds * 1000), timeZone).date;
}

export function scaleYahooBars(result, { timeZone = 'America/New_York' } = {}) {
  const timestamps = result?.timestamp || [];
  const quote = result?.indicators?.quote?.[0] || {};
  const adj = result?.indicators?.adjclose?.[0]?.adjclose || [];
  const bars = [];
  let skipped = 0;
  for (let i = 0; i < timestamps.length; i++) {
    const close = quote.close?.[i];
    const open = quote.open?.[i];
    const high = quote.high?.[i];
    const low = quote.low?.[i];
    const volume = quote.volume?.[i];
    if (close == null || open == null || high == null || low == null) {
      skipped += 1;
      continue;
    }
    if (!(close > 0) || !(open > 0)) {
      skipped += 1;
      continue;
    }
    const adjusted = adj[i] > 0 ? adj[i] : close;
    const factor = close > 0 ? adjusted / close : 1;
    bars.push({
      date: chartDate(timestamps[i], timeZone),
      open: open * factor,
      high: high * factor,
      low: low * factor,
      close: adjusted,
      volume: volume || 0,
    });
  }
  return {
    bars,
    skipped,
    currency: result?.meta?.currency || null,
    exchange: result?.meta?.exchangeName || null,
    instrument: result?.meta?.instrumentType || null,
    name: result?.meta?.longName || result?.meta?.shortName || null,
  };
}

export async function fetchYahooChart(symbol, { start, end = new Date(), retries = 4 } = {}) {
  const period1 = Math.floor(Date.parse(`${start}T00:00:00Z`) / 1000);
  const period2 = Math.floor(new Date(end).getTime() / 1000) + 86400;
  const url = `${YAHOO_CHART_ENDPOINT}/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=1d&events=div%7Csplit`;
  let lastError = null;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'user-agent': USER_AGENT,
          accept: 'application/json',
        },
        signal: AbortSignal.timeout(30000),
      });
      if (response.status === 429) {
        await sleep(1000 * (attempt + 1));
        continue;
      }
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Yahoo chart ${symbol} ${response.status}: ${text.slice(0, 200)}`);
      }
      const body = await response.json();
      const result = body.chart?.result?.[0];
      if (!result) {
        const description = body.chart?.error?.description || 'no result';
        throw new Error(`Yahoo chart ${symbol}: ${description}`);
      }
      return result;
    } catch (error) {
      lastError = error;
      if (attempt + 1 < retries) await sleep(500 * (attempt + 1));
    }
  }
  throw lastError || new Error(`Yahoo chart ${symbol}: failed`);
}

export async function fetchYahooBars(symbol, { start, end, timeZone = 'America/New_York' } = {}) {
  const result = await fetchYahooChart(symbol, { start, end });
  const scaled = scaleYahooBars(result, { timeZone });
  return {
    ...scaled,
    yahooSymbol: symbol,
    endpoint: `${YAHOO_CHART_ENDPOINT}/${encodeURIComponent(symbol)}`,
  };
}

export async function fetchYahooBasket(symbols, { start, end, pauseMs = 250 } = {}) {
  const bars = {};
  const meta = {};
  for (const symbol of symbols) {
    const yahooSymbol = yahooSymbolFor(symbol);
    const fetched = await fetchYahooBars(yahooSymbol, { start, end });
    bars[symbol] = fetched.bars;
    meta[symbol] = {
      yahooSymbol,
      currency: fetched.currency,
      exchange: fetched.exchange,
      instrument: fetched.instrument,
      name: fetched.name,
      skipped: fetched.skipped,
      barCount: fetched.bars.length,
      first: fetched.bars[0]?.date || null,
      last: fetched.bars[fetched.bars.length - 1]?.date || null,
    };
    console.log(`${symbol} ${yahooSymbol} ${fetched.bars.length} ${meta[symbol].first || 'none'} ${meta[symbol].last || 'none'}`);
    if (pauseMs) await sleep(pauseMs);
  }
  return { bars, meta };
}
