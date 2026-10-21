import { readFileSync } from 'node:fs';
import { upperBound } from './dates.js';

export function validBar(bar) {
  if (!bar || !/^\d{4}-\d{2}-\d{2}$/.test(bar.date || '')) return false;
  const { open, high, low, close, volume } = bar;
  if (![open, high, low, close, volume].every((value) => Number.isFinite(value))) return false;
  if (!(close > 0) || !(open > 0) || !(high > 0) || !(low > 0) || volume < 0) return false;
  const top = Math.max(open, close);
  const bottom = Math.min(open, close);
  return high + 1e-4 >= top && low - 1e-4 <= bottom && high + 1e-4 >= low;
}

export function normalizeBars(rows) {
  const byDate = new Map();
  let dropped = 0;
  let repaired = 0;
  for (const row of rows) {
    if (!row || !/^\d{4}-\d{2}-\d{2}$/.test(row.date || '')) {
      dropped += 1;
      continue;
    }
    const open = Number(row.open);
    const close = Number(row.close);
    const volume = Number(row.volume);
    if (!(open > 0) || !(close > 0) || !Number.isFinite(volume) || volume < 0) {
      dropped += 1;
      continue;
    }
    let high = Number(row.high);
    let low = Number(row.low);
    const top = Math.max(open, close);
    const bottom = Math.min(open, close);
    if (!Number.isFinite(high) || !Number.isFinite(low) || high < top || low > bottom || high < low) {
      high = Math.max(Number.isFinite(high) ? high : 0, top);
      low = Math.min(Number.isFinite(low) ? low : top, bottom);
      repaired += 1;
    }
    byDate.set(row.date, { date: row.date, open, high, low, close, volume });
  }
  const bars = [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return { bars, dropped, repaired };
}

export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function assertUsCache(cache) {
  if (!cache || cache.feed !== 'sip' || cache.adjustment !== 'all' || cache.timeframe !== '1Day') {
    throw new Error('US cache must be Alpaca daily bars with feed=sip and adjustment=all.');
  }
  if (!cache.bars?.AAPL?.length) throw new Error('US cache has no AAPL bars, so there is no session calendar.');
}

export function assertVuaaCache(cache) {
  if (!cache) throw new Error('Refusing to write the comparison: the VUAA cache is missing.');
  if (cache.feed === 'sip') throw new Error('Refusing to write the comparison: VUAA must not be requested from feed=sip.');
  if (!Array.isArray(cache.bars) || cache.bars.length === 0) {
    throw new Error('Refusing to write the comparison: the VUAA cache is empty.');
  }
}

export function assertYahooUsCache(cache) {
  if (!cache || cache.source !== 'yahoo-finance-chart' || cache.adjustment !== 'yahoo-adjclose-scaled') {
    throw new Error('Yahoo US cache must be yahoo-finance-chart daily bars with adjclose scaling.');
  }
  if (cache.feed === 'sip') throw new Error('Yahoo US cache must not be marked feed=sip.');
  if (!cache.bars?.AAPL?.length) throw new Error('Yahoo US cache has no AAPL bars, so there is no session calendar.');
}

export function assertVfinxCache(cache) {
  if (!cache) throw new Error('Refusing to write the long comparison: the VFINX cache is missing.');
  if (cache.feed === 'sip') throw new Error('Refusing to write the long comparison: VFINX must not be requested from feed=sip.');
  if (cache.source !== 'yahoo-finance-chart' || cache.adjustment !== 'yahoo-adjclose-scaled') {
    throw new Error('VFINX cache must be yahoo-finance-chart daily bars with adjclose scaling.');
  }
  if (!Array.isArray(cache.bars) || cache.bars.length === 0) {
    throw new Error('Refusing to write the long comparison: the VFINX cache is empty.');
  }
}

export function indexBars(bars) {
  const sorted = [...bars].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const dates = sorted.map((bar) => bar.date);
  const byDate = new Map(sorted.map((bar) => [bar.date, bar]));
  return {
    dates,
    exact(date) {
      return byDate.get(date) || null;
    },
    open(date) {
      const bar = byDate.get(date);
      return bar && bar.open > 0 ? bar.open : null;
    },
    carryClose(date) {
      const index = upperBound(dates, date) - 1;
      if (index < 0) return null;
      const bar = sorted[index];
      return { price: bar.close, carried: bar.date !== date, barDate: bar.date };
    },
  };
}

export function gapSummary(barsBySymbol, sessions) {
  return Object.keys(barsBySymbol).sort().map((symbol) => {
    const bars = barsBySymbol[symbol] || [];
    if (bars.length === 0) return { symbol, bars: 0, first: null, last: null, missing: null };
    const dates = new Set(bars.map((bar) => bar.date));
    const first = bars[0].date;
    const last = bars[bars.length - 1].date;
    let missing = 0;
    for (const session of sessions) {
      if (session < first || session > last) continue;
      if (!dates.has(session)) missing += 1;
    }
    return { symbol, bars: bars.length, first, last, missing };
  });
}
