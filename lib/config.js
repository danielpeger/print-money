/** Fixed inputs. Changing the basket, the fallback list, or a window changes the books. */

export const BASKET = Object.freeze([
  'GOOGL', 'AAPL', 'DIS', 'SPOT', 'FIG', 'RACE', 'AMZN', 'BRK.B', 'NFLX', 'SNDK',
  'IBM', 'DE', 'PFE', 'UBER', 'DELL', 'ADBE', 'HOOD', 'DDOG', 'UPS', 'ABNB',
  'MAR', 'ADSK', 'F', 'NKE', 'GRMN', 'EBAY', 'IBKR', 'HPQ', 'RDDT', 'RL',
  'PLTR', 'NVDA', 'SKYD', 'SPCX',
]);

/** Median dollar volume over the 252 sessions ending 9 October 2026. Most traded first. Does not refresh. */
export const FALLBACK = Object.freeze([
  'NVDA', 'SNDK', 'AAPL', 'SPCX', 'AMZN', 'GOOGL', 'PLTR', 'NFLX', 'HOOD', 'BRK.B',
  'IBM', 'DELL', 'UBER', 'ADBE', 'PFE',
]);

export const BOOKS = Object.freeze({
  trend: { code: 'trend', name: 'Trend', slots: 15 },
  dip: { code: 'dip', name: 'Dip', slots: 10 },
  control: { code: 'control', name: 'Control', slots: BASKET.length },
});

export const SMA_LONG = 200;
export const SMA_SHORT = 20;
export const MOMENTUM_LOOKBACK = 126;
export const MOMENTUM_SKIP = 21;

export const BOOK_CAPITAL = 5000;
export const MIN_NOTIONAL = 1;
export const COST_RATE = 0.0005;
export const COST_RATE_PESSIMISTIC = 0.002;

/** First session that can be the comparison start. VUAA listed on this date. */
export const COMPARISON_NOT_BEFORE = '2019-05-16';

/** Fetch start for the Yahoo long sample. Warmup bars before the comparison stay out of the score. */
export const LONG_HISTORY_START = '2005-01-01';

/** First session that can start the Yahoo long comparison. Covers the 2008 crash with a 200-day average already warm. */
export const LONG_COMPARISON_NOT_BEFORE = '2006-01-03';

export const YAHOO_CHART_ENDPOINT = 'https://query1.finance.yahoo.com/v8/finance/chart';

/** Alpaca uses a dot, Yahoo uses a hyphen. Other basket names match. */
export const YAHOO_SYMBOL = Object.freeze({
  'BRK.B': 'BRK-B',
});

export function yahooSymbolFor(symbol) {
  return YAHOO_SYMBOL[symbol] || symbol;
}

export const VFINX = Object.freeze({
  ticker: 'VFINX',
  yahooSymbol: 'VFINX',
  currency: 'USD',
  name: 'Vanguard 500 Index Fund Investor Shares',
});

/**
 * S&P 500 peak-to-trough crashes and the bulls around them.
 * Dates are the first session after the peak through the trough, then the next bull.
 */
export const EVENT_WINDOWS = Object.freeze([
  { id: 'pre_gfc', label: 'Pre-GFC bull', start: '2006-01-03', end: '2007-10-09', kind: 'bull' },
  { id: 'gfc_crash', label: 'GFC peak to trough', start: '2007-10-10', end: '2009-03-09', kind: 'crash' },
  { id: 'post_gfc', label: 'Post-GFC bull', start: '2009-03-10', end: '2020-02-19', kind: 'bull' },
  { id: 'covid_crash', label: 'COVID peak to trough', start: '2020-02-20', end: '2020-03-23', kind: 'crash' },
  { id: 'post_covid', label: 'Post-COVID bull', start: '2020-03-24', end: '9999-12-31', kind: 'bull' },
]);

/** NBER US recession dates, used as a second cut next to the market peak-to-trough windows. */
export const NBER_WINDOWS = Object.freeze([
  { id: 'gfc_recession', label: 'NBER recession 2007-09', start: '2007-12-01', end: '2009-06-30', kind: 'recession' },
  { id: 'expansion_2010s', label: 'NBER expansion 2009-20', start: '2009-07-01', end: '2020-01-31', kind: 'expansion' },
  { id: 'covid_recession', label: 'NBER recession 2020', start: '2020-02-01', end: '2020-04-30', kind: 'recession' },
  { id: 'expansion_2020s', label: 'NBER expansion 2020-', start: '2020-05-01', end: '9999-12-31', kind: 'expansion' },
]);

export const YAHOO_HISTORY_NOTES = Object.freeze({
  SKYD: 'Yahoo maps SKYD to a series from 2005. Skydance listed in 2025 via a reverse merger; that earlier history is a predecessor, not the operating company.',
});

/** US session on which the three paper books open. */
export const START_SESSION = '2026-10-13';

/** Latest four years of the comparison are the out-of-sample window. */
export const OOS_YEARS = 4;
export const TRADING_DAYS_PER_YEAR = 252;

export const VUAA = Object.freeze({
  ticker: 'VUAA',
  yahooSymbol: 'VUAA.L',
  isin: 'IE00BFMXXD54',
  currency: 'USD',
  name: 'Vanguard S&P 500 UCITS ETF USD Accumulating',
});

export const US_CACHE = 'data/bars/us-sip.json';
export const VUAA_CACHE = 'data/bars/vuaa.json';
export const US_YAHOO_CACHE = 'data/bars/us-yahoo.json';
export const VFINX_CACHE = 'data/bars/vfinx.json';
export const REPORT_PATH = 'reports/backtest.md';
export const LONG_EQUITY_PATH = 'reports/equity-long.csv';

export const FILL_MODEL = [
  'A signal is computed from completed daily bars.',
  'The earliest fill is the next regular session, at that session\'s open.',
  'The cost rate is taken out of the buy budget and out of sell proceeds.',
  'A missing open skips that name.',
  'On the opening session the skipped slot is filled from the next eligible name at the same dollar amount.',
  'A paired buy after that is sized from the paired sale\'s proceeds.',
].join(' ');

export const COST_NOTE = [
  `Base cost is ${COST_RATE * 10000} bps of notional on every simulated fill.`,
  `The pessimistic case uses ${COST_RATE_PESSIMISTIC * 10000} bps.`,
  'These are flat assumptions. The backtest does not replay quotes.',
  'The paper job logs the session opening SIP quote separately and does not feed that quote back into these books.',
].join(' ');

export const SHARPE_NOTE = [
  'Sharpe uses close-to-close returns, a risk-free rate of 0, and the sample standard deviation (n − 1).',
  `It is annualized with the square root of ${TRADING_DAYS_PER_YEAR}.`,
  'It is not excess over Treasury bills.',
].join(' ');

export const CAGR_NOTE = [
  'CAGR is ending equity divided by the equity at the start of the window,',
  'raised to 365.25 divided by the calendar days between the first and last session, minus one.',
].join(' ');
