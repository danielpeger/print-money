import { TRADING_DAYS_PER_YEAR } from './config.js';
import { calendarDaysBetween } from './dates.js';

function mean(values) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sampleStdev(values) {
  if (values.length < 2) return null;
  const avg = mean(values);
  const square = values.reduce((sum, value) => sum + (value - avg) ** 2, 0);
  return Math.sqrt(square / (values.length - 1));
}

export function summarize(curve, { startingCapital, startDate, endDate, trades = [], fillCount = 0, tradedNotional = 0 } = {}) {
  const levels = [startingCapital, ...curve.map((point) => point.equity)];
  const returns = [];
  for (let i = 1; i < levels.length; i++) {
    const previous = levels[i - 1];
    returns.push(previous > 0 ? levels[i] / previous - 1 : 0);
  }
  const endEquity = levels[levels.length - 1];
  const totalReturn = startingCapital > 0 ? endEquity / startingCapital - 1 : null;
  const days = startDate && endDate ? calendarDaysBetween(startDate, endDate) : 0;
  const years = days > 0 ? days / 365.25 : null;
  const cagr = years && startingCapital > 0 && endEquity > 0 ? (endEquity / startingCapital) ** (1 / years) - 1 : null;
  const stdev = sampleStdev(returns);
  const avg = mean(returns);
  const volatility = stdev == null ? null : stdev * Math.sqrt(TRADING_DAYS_PER_YEAR);
  const sharpe = stdev && stdev > 0 && avg != null ? (avg / stdev) * Math.sqrt(TRADING_DAYS_PER_YEAR) : null;

  let peak = levels[0];
  let peakIndex = 0;
  let maxDrawdown = 0;
  let maxPeakIndex = 0;
  let maxTroughIndex = 0;
  for (let i = 0; i < levels.length; i++) {
    if (levels[i] >= peak) {
      peak = levels[i];
      peakIndex = i;
    }
    const drawdown = peak > 0 ? levels[i] / peak - 1 : 0;
    if (drawdown < maxDrawdown) {
      maxDrawdown = drawdown;
      maxPeakIndex = peakIndex;
      maxTroughIndex = i;
    }
  }
  const peakValue = levels[maxPeakIndex];
  let recoveryIndex = levels.length - 1;
  for (let i = maxTroughIndex; i < levels.length; i++) {
    if (levels[i] >= peakValue) {
      recoveryIndex = i;
      break;
    }
  }
  const durationSessions = recoveryIndex - maxPeakIndex;

  const wins = trades.filter((trade) => trade.pnl > 0);
  const losses = trades.filter((trade) => trade.pnl <= 0);
  const avgEquity = mean(levels);
  const turnover = years && avgEquity > 0 ? (tradedNotional / 2) / avgEquity / years : null;

  return {
    startDate,
    endDate,
    observations: returns.length,
    startingCapital,
    endEquity,
    totalReturn,
    cagr,
    maxDrawdown,
    drawdownSessions: durationSessions,
    volatility,
    sharpe,
    trades: trades.length,
    fills: fillCount,
    turnover,
    winRate: trades.length ? wins.length / trades.length : null,
    avgWin: wins.length ? mean(wins.map((trade) => trade.pnl)) : null,
    avgLoss: losses.length ? mean(losses.map((trade) => trade.pnl)) : null,
  };
}

export function windowSummary(curve, startingCapital, fromDate, toDate, extras = {}) {
  let base = startingCapital;
  let baseDate = fromDate;
  for (const point of curve) {
    if (point.date < fromDate) {
      base = point.equity;
      baseDate = point.date;
    }
  }
  const slice = curve.filter((point) => point.date >= fromDate && point.date <= toDate);
  if (slice.length === 0) return null;
  return summarize(slice, {
    startingCapital: base,
    startDate: slice[0].date,
    endDate: slice[slice.length - 1].date,
    ...extras,
  });
}

export function yearlyReturns(curve, startingCapital) {
  const years = [...new Set(curve.map((point) => point.date.slice(0, 4)))];
  return years.map((year) => {
    const summary = windowSummary(curve, startingCapital, `${year}-01-01`, `${year}-12-31`);
    return {
      year,
      totalReturn: summary?.totalReturn ?? null,
      endEquity: summary?.endEquity ?? null,
      maxDrawdown: summary?.maxDrawdown ?? null,
    };
  });
}

export function edges(bookReturn, controlReturn, vuaaReturn) {
  return {
    selection: bookReturn != null && controlReturn != null ? bookReturn > controlReturn : null,
    market: bookReturn != null && vuaaReturn != null ? bookReturn > vuaaReturn : null,
  };
}

export function walkForwardWindows(curve, startingCapital, window = 252, step = 126) {
  const folds = [];
  for (let start = 0; start < curve.length; start += step) {
    const end = Math.min(curve.length - 1, start + window - 1);
    if (end - start < 60) break;
    const summary = windowSummary(curve, startingCapital, curve[start].date, curve[end].date);
    folds.push({
      from: curve[start].date,
      to: curve[end].date,
      totalReturn: summary?.totalReturn ?? null,
      cagr: summary?.cagr ?? null,
      maxDrawdown: summary?.maxDrawdown ?? null,
    });
    if (end === curve.length - 1) break;
  }
  return folds;
}

export function namedWindows(curve, startingCapital, windows, sampleStart, sampleEnd) {
  return windows.map((window) => {
    const from = window.start < sampleStart ? sampleStart : window.start;
    const to = window.end > sampleEnd ? sampleEnd : window.end;
    if (!from || !to || to < from) {
      return { ...window, from, to, summary: null, overlaps: false };
    }
    const slice = curve.filter((point) => point.date >= from && point.date <= to);
    if (slice.length === 0) {
      return { ...window, from, to, summary: null, overlaps: false };
    }
    return {
      ...window,
      from: slice[0].date,
      to: slice[slice.length - 1].date,
      summary: windowSummary(curve, startingCapital, from, to),
      overlaps: true,
    };
  });
}

export function regimeBuckets(curve, startingCapital, regimeByDate) {
  let previous = startingCapital;
  const groups = { uptrend: [], downtrend: [], warmup: [] };
  for (const point of curve) {
    const regime = regimeByDate.get(point.date) || 'warmup';
    const daily = previous > 0 ? point.equity / previous - 1 : 0;
    (groups[regime] || groups.warmup).push(daily);
    previous = point.equity;
  }
  return Object.fromEntries(Object.entries(groups).map(([name, returns]) => {
    const compounded = returns.reduce((product, value) => product * (1 + value), 1) - 1;
    return [name, { sessions: returns.length, totalReturn: returns.length ? compounded : null }];
  }));
}
