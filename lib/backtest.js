import {
  BASKET,
  BOOK_CAPITAL,
  COMPARISON_NOT_BEFORE,
  COST_RATE,
  COST_RATE_PESSIMISTIC,
  EVENT_WINDOWS,
  NBER_WINDOWS,
  OOS_YEARS,
  VUAA,
} from './config.js';
import { gapSummary, indexBars } from './bars.js';
import { signalSeries } from './indicators.js';
import { edges, namedWindows, summarize, walkForwardWindows, windowSummary, yearlyReturns, regimeBuckets } from './metrics.js';
import { buildSignalMaps, simulateActive, simulateHold } from './simulate.js';
import { shiftYears, upperBound } from './dates.js';

export function comparisonWindow(sessions, benchmarkDates, { notBefore = COMPARISON_NOT_BEFORE } = {}) {
  if (!sessions.length || !benchmarkDates.length) return { start: null, end: null };
  const firstBenchmark = benchmarkDates[0];
  const lastBenchmark = benchmarkDates[benchmarkDates.length - 1];
  let start = null;
  for (let i = 1; i < sessions.length; i++) {
    const session = sessions[i];
    if (session < notBefore || session < firstBenchmark) continue;
    if (i - 1 < 199) continue;
    start = session;
    break;
  }
  let end = null;
  for (let i = sessions.length - 1; i >= 0; i--) {
    if (sessions[i] <= lastBenchmark) {
      end = sessions[i];
      break;
    }
  }
  if (!start || !end || end < start) {
    return { start: null, end: null, firstVuaa: firstBenchmark, lastVuaa: lastBenchmark, firstBenchmark, lastBenchmark };
  }
  return { start, end, firstVuaa: firstBenchmark, lastVuaa: lastBenchmark, firstBenchmark, lastBenchmark };
}

function runCosts(run, rates) {
  const out = {};
  for (const [name, rate] of Object.entries(rates)) {
    const result = run(rate);
    if (!result.ok) return result;
    out[name] = result;
  }
  return { ok: true, ...out };
}

function pack(result, capital, startDate, endDate) {
  return {
    summary: summarize(result.curve, {
      startingCapital: capital,
      startDate,
      endDate,
      trades: result.trades,
      fillCount: result.fills,
      tradedNotional: result.tradedNotional,
    }),
    curve: result.curve,
    trades: result.trades.length,
    fills: result.fills,
    skipped: countSkipped(result.skipped),
    blocked: result.blocked.length,
    missing: result.missing || [],
    carriedSessions: result.carriedSessions,
    carriedMarks: result.carriedMarks,
    cash: result.cash,
    positions: result.positions,
  };
}

function countSkipped(skipped) {
  const counts = {};
  for (const row of skipped || []) {
    const key = row.reason || 'unknown';
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function benchmarkRegimeMap(benchmarkBars, sessions, symbol) {
  const signals = signalSeries(benchmarkBars.map((bar) => ({ ...bar, symbol })));
  const dates = signals.map((row) => row.date);
  const map = new Map();
  for (const session of sessions) {
    const index = upperBound(dates, session) - 1;
    if (index < 0 || signals[index].sma200 == null) {
      map.set(session, 'warmup');
    } else {
      map.set(session, signals[index].close > signals[index].sma200 ? 'uptrend' : 'downtrend');
    }
  }
  return map;
}

export function runResearch({
  usBars,
  vuaaBars,
  usMeta,
  vuaaMeta,
  notBefore = COMPARISON_NOT_BEFORE,
  benchmarkName = 'VUAA',
  sample = 'alpaca-vuaa',
  eventWindows = EVENT_WINDOWS,
  nberWindows = NBER_WINDOWS,
} = {}) {
  const normalized = {};
  for (const symbol of BASKET) normalized[symbol] = usBars[symbol] || [];
  const sessions = (normalized.AAPL || []).map((bar) => bar.date);
  const benchmarkDates = vuaaBars.map((bar) => bar.date);
  const window = comparisonWindow(sessions, benchmarkDates, { notBefore });
  if (!window.start) {
    throw new Error(`No comparison window: need a ${benchmarkName} bar and a warmed-up signal on or after ${notBefore}.`);
  }

  const indexes = new Map();
  for (const symbol of BASKET) indexes.set(symbol, indexBars(normalized[symbol]));
  indexes.set(benchmarkName, indexBars(vuaaBars));
  const signalMaps = buildSignalMaps(normalized);
  const span = sessions.filter((date) => date >= window.start && date <= window.end);
  const rates = { gross: 0, net: COST_RATE, pessimistic: COST_RATE_PESSIMISTIC };

  const active = (bookName) => runCosts(
    (costRate) => simulateActive({
      bookName,
      sessions,
      indexes,
      signalMaps,
      comparisonStart: window.start,
      comparisonEnd: window.end,
      costRate,
    }),
    rates,
  );
  const hold = (symbols) => runCosts(
    (costRate) => simulateHold({
      symbols,
      sessions,
      indexes,
      comparisonStart: window.start,
      comparisonEnd: window.end,
      costRate,
    }),
    rates,
  );

  const trend = active('trend');
  const dip = active('dip');
  const control = hold(BASKET);
  const benchmark = hold([benchmarkName]);
  for (const result of [trend, dip, control, benchmark]) {
    if (!result.ok) throw new Error(`Simulation failed: ${result.reason || 'unknown'} ${result.symbol || ''} ${result.date || ''}`);
  }

  const packOne = (result) => pack(result, BOOK_CAPITAL, window.start, window.end);
  const series = {
    Trend: packOne(trend.net),
    Dip: packOne(dip.net),
    Control: packOne(control.net),
    [benchmarkName]: packOne(benchmark.net),
  };
  const summarizeCurve = (curve) => summarize(curve, { startingCapital: BOOK_CAPITAL, startDate: window.start, endDate: window.end });
  const gross = {
    Trend: summarizeCurve(trend.gross.curve),
    Dip: summarizeCurve(dip.gross.curve),
    Control: summarizeCurve(control.gross.curve),
    [benchmarkName]: summarizeCurve(benchmark.gross.curve),
  };
  const pessimistic = {
    Trend: summarizeCurve(trend.pessimistic.curve),
    Dip: summarizeCurve(dip.pessimistic.curve),
    Control: summarizeCurve(control.pessimistic.curve),
    [benchmarkName]: summarizeCurve(benchmark.pessimistic.curve),
  };

  const oosBoundary = shiftYears(window.end, -OOS_YEARS);
  const oosStart = span.find((date) => date >= oosBoundary) || window.end;
  const developmentEnd = [...span].reverse().find((date) => date < oosStart) || window.start;
  const regimeMap = benchmarkRegimeMap(vuaaBars, span, benchmarkName);

  const names = ['Trend', 'Dip', 'Control', benchmarkName];
  const curves = {
    Trend: trend.net.curve,
    Dip: dip.net.curve,
    Control: control.net.curve,
    [benchmarkName]: benchmark.net.curve,
  };

  function slicePack(name, from, to) {
    return windowSummary(curves[name], BOOK_CAPITAL, from, to);
  }

  const oosRows = names.map((name) => {
    const summary = slicePack(name, oosStart, window.end);
    const controlReturn = slicePack('Control', oosStart, window.end)?.totalReturn;
    const marketReturn = slicePack(benchmarkName, oosStart, window.end)?.totalReturn;
    const bookEdges = name === benchmarkName ? { selection: null, market: null } : edges(summary?.totalReturn, controlReturn, marketReturn);
    if (name === 'Control') bookEdges.selection = null;
    return { name, summary, ...bookEdges };
  });

  const devRows = names.map((name) => ({ name, summary: slicePack(name, window.start, developmentEnd) }));

  const yearly = Object.fromEntries(names.map((name) => [name, yearlyReturns(curves[name], BOOK_CAPITAL)]));
  const folds = Object.fromEntries(names.map((name) => [name, walkForwardWindows(curves[name], BOOK_CAPITAL)]));
  const regimes = Object.fromEntries(names.map((name) => [name, regimeBuckets(curves[name], BOOK_CAPITAL, regimeMap)]));
  const events = Object.fromEntries(names.map((name) => [name, namedWindows(curves[name], BOOK_CAPITAL, eventWindows, window.start, window.end)]));
  const nber = Object.fromEntries(names.map((name) => [name, namedWindows(curves[name], BOOK_CAPITAL, nberWindows, window.start, window.end)]));

  const firstUs = sessions[0];
  const lastUs = sessions[sessions.length - 1];
  const gaps = gapSummary(normalized, sessions);
  const presentAtStart = BASKET.filter((symbol) => indexes.get(symbol)?.open(window.start) != null);
  const missingAtStart = BASKET.filter((symbol) => indexes.get(symbol)?.open(window.start) == null);

  function holdingsWeights(holdings, cash, date) {
    const rows = [];
    let equity = cash;
    for (const row of holdings || []) {
      const quote = indexes.get(row.symbol)?.carryClose(date);
      if (!quote || !(quote.price > 0)) continue;
      const value = row.shares * quote.price;
      equity += value;
      rows.push({ symbol: row.symbol, value, shares: row.shares });
    }
    rows.sort((a, b) => b.value - a.value);
    return {
      date,
      equity,
      cash,
      cashWeight: equity > 0 ? cash / equity : 0,
      names: rows.map((row) => ({
        symbol: row.symbol,
        weight: equity > 0 ? row.value / equity : 0,
      })),
    };
  }

  const controlOosWeights = holdingsWeights(control.net.holdings, control.net.cash, oosStart);

  return {
    sample,
    benchmarkName,
    names,
    capital: BOOK_CAPITAL,
    comparisonStart: window.start,
    comparisonEnd: window.end,
    oosStart,
    developmentEnd,
    firstUs,
    lastUs,
    firstVuaa: window.firstBenchmark,
    lastVuaa: window.lastBenchmark,
    firstBenchmark: window.firstBenchmark,
    lastBenchmark: window.lastBenchmark,
    sessions: span.length,
    vuaaBarCount: vuaaBars.length,
    usMeta,
    vuaaMeta: {
      source: vuaaMeta.source,
      endpoint: vuaaMeta.endpoint,
      symbol: vuaaMeta.symbol || (benchmarkName === 'VUAA' ? VUAA.yahooSymbol : benchmarkName),
      isin: vuaaMeta.isin || (benchmarkName === 'VUAA' ? VUAA.isin : null),
      currency: vuaaMeta.currency,
      adjustment: vuaaMeta.adjustment,
      note: vuaaMeta.note,
      feed: vuaaMeta.feed,
      name: vuaaMeta.name,
    },
    gaps,
    presentAtStart,
    missingAtStart,
    series,
    gross,
    pessimistic,
    oosRows,
    devRows,
    yearly,
    folds,
    regimes,
    events,
    nber,
    curves,
    controlMissing: control.net.missing,
    controlOosWeights,
    vuaaCarriedSessions: benchmark.net.carriedSessions,
    controlCarriedSessions: control.net.carriedSessions,
  };
}
