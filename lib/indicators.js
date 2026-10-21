import {
  SMA_LONG,
  SMA_SHORT,
  MOMENTUM_LOOKBACK,
  MOMENTUM_SKIP,
} from './config.js';

export function smaAt(closes, index, period) {
  if (index < period - 1) return null;
  let sum = 0;
  for (let i = index - period + 1; i <= index; i++) sum += closes[i];
  return sum / period;
}

/** close[index - skip] / close[index - skip - lookback] - 1. Null until both closes exist. */
export function momentumAt(closes, index, lookback = MOMENTUM_LOOKBACK, skip = MOMENTUM_SKIP) {
  const end = index - skip;
  const start = end - lookback;
  if (start < 0 || end < 0) return null;
  const base = closes[start];
  const last = closes[end];
  if (!(base > 0) || !(last > 0)) return null;
  return last / base - 1;
}

export function signalAt(closes, index, options = {}) {
  const longPeriod = options.smaLong ?? SMA_LONG;
  const shortPeriod = options.smaShort ?? SMA_SHORT;
  const close = closes[index];
  const sma200 = smaAt(closes, index, longPeriod);
  const sma20 = smaAt(closes, index, shortPeriod);
  const momentum = momentumAt(closes, index, options.momentumLookback, options.momentumSkip);
  const warmed = sma200 != null && momentum != null;
  const trendQualifier = Boolean(warmed && close > sma200 && momentum > 0);
  const dipSetup = Boolean(trendQualifier && sma20 != null && close < sma20);
  return { close, sma200, sma20, momentum, warmed, trendQualifier, dipSetup };
}

export function signalSeries(bars, options = {}) {
  const longPeriod = options.smaLong ?? SMA_LONG;
  const shortPeriod = options.smaShort ?? SMA_SHORT;
  const closes = bars.map((bar) => bar.close);
  const out = new Array(bars.length);
  let sumLong = 0;
  let sumShort = 0;
  for (let i = 0; i < closes.length; i++) {
    sumLong += closes[i];
    sumShort += closes[i];
    if (i >= longPeriod) sumLong -= closes[i - longPeriod];
    if (i >= shortPeriod) sumShort -= closes[i - shortPeriod];
    const close = closes[i];
    const sma200 = i >= longPeriod - 1 ? sumLong / longPeriod : null;
    const sma20 = i >= shortPeriod - 1 ? sumShort / shortPeriod : null;
    const momentum = momentumAt(closes, i, options.momentumLookback, options.momentumSkip);
    const warmed = sma200 != null && momentum != null;
    const trendQualifier = Boolean(warmed && close > sma200 && momentum > 0);
    const dipSetup = Boolean(trendQualifier && sma20 != null && close < sma20);
    out[i] = {
      symbol: bars[i].symbol,
      date: bars[i].date,
      close,
      sma200,
      sma20,
      momentum,
      warmed,
      trendQualifier,
      dipSetup,
    };
  }
  return out;
}
