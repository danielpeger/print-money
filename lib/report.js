import {
  BASKET,
  CAGR_NOTE,
  COST_NOTE,
  FALLBACK,
  FILL_MODEL,
  MOMENTUM_LOOKBACK,
  MOMENTUM_SKIP,
  SHARPE_NOTE,
  SMA_LONG,
  SMA_SHORT,
  YAHOO_HISTORY_NOTES,
} from './config.js';
import { formatPct, formatUsd } from './dates.js';

function num(value, digits = 2) {
  if (value == null || Number.isNaN(value)) return 'n/a';
  return Number(value).toFixed(digits);
}

function yesNo(value) {
  if (value == null) return 'n/a';
  return value ? 'yes' : 'no';
}

function row(cells) {
  return `| ${cells.join(' | ')} |`;
}

function namesOf(result) {
  return result.names || ['Trend', 'Dip', 'Control', result.benchmarkName || 'VUAA'];
}

function marketName(result) {
  return result.benchmarkName || 'VUAA';
}

export function renderReport(result) {
  const bench = marketName(result);
  const names = namesOf(result);
  const lines = [];
  lines.push('# Basket books');
  lines.push('');
  lines.push(`Trend, Dip, and Control are simulated on the same sessions and the same $5,000. ${bench} is a fourth series and is not a book.`);
  lines.push('');
  lines.push('## Answers');
  lines.push('');
  lines.push(`Out-of-sample window: ${result.oosStart} through ${result.comparisonEnd}.`);
  lines.push(`A selection edge means the book beat Control after costs in that window. A market edge means it beat ${bench} after costs in that window. One window is not enough to accept either.`);
  lines.push('');
  lines.push(row(['Book', 'Out-of-sample return', 'Selection edge', 'Market edge']));
  lines.push(row(['---', '---', '---', '---']));
  for (const entry of result.oosRows) {
    if (entry.name === bench) continue;
    lines.push(row([
      entry.name,
      formatPct(entry.summary?.totalReturn),
      yesNo(entry.selection),
      yesNo(entry.market),
    ]));
  }
  lines.push('');
  lines.push('These are the results of the fixed rules on this one window. They are not a decision to keep or drop a book.');
  lines.push('');
  lines.push('## Full sample, after the base cost');
  lines.push('');
  lines.push(metricsTable(result.series));
  lines.push('');
  lines.push(`Comparison: ${result.comparisonStart} through ${result.comparisonEnd} (${result.sessions} US sessions).`);
  lines.push(`Starting capital: ${formatUsd(result.capital)}.`);
  lines.push('');
  lines.push('## Gross, net, and pessimistic');
  lines.push('');
  lines.push(row(['Series', 'Gross CAGR', 'Net CAGR', 'Pessimistic CAGR', 'Net max drawdown']));
  lines.push(row(['---', '---', '---', '---', '---']));
  for (const name of names) {
    lines.push(row([
      name,
      formatPct(result.gross[name].cagr),
      formatPct(result.series[name].summary.cagr),
      formatPct(result.pessimistic[name].cagr),
      formatPct(result.series[name].summary.maxDrawdown),
    ]));
  }
  lines.push('');
  lines.push(COST_NOTE);
  lines.push('');
  lines.push('## Out of sample and development');
  lines.push('');
  if (result.sample === 'yahoo-long') {
    lines.push(`Development is ${result.comparisonStart} through ${result.developmentEnd}. That window includes the 2008 crash. The reserved out-of-sample years still start at ${result.oosStart}.`);
  } else {
    lines.push(`Development is ${result.comparisonStart} through ${result.developmentEnd}. That window is short, and it is the only history available before the reserved out-of-sample years.`);
  }
  lines.push('');
  lines.push(metricsTable(Object.fromEntries(result.devRows.map((entry) => [entry.name, { summary: entry.summary }])), { activity: false }));
  lines.push('');
  lines.push(metricsTable(Object.fromEntries(result.oosRows.map((entry) => [entry.name, { summary: entry.summary }])), { activity: false }));
  lines.push('');
  lines.push('## Each series against the others');
  lines.push('');
  lines.push('Difference in full-sample total return (row minus column), after the base cost.');
  lines.push('');
  lines.push(differenceTable(result.series));
  lines.push('');
  lines.push('## Calendar year');
  lines.push('');
  lines.push(yearTable(result.yearly, names));
  lines.push('');
  lines.push(...crashBullSections(result));
  lines.push('## Walk-forward');
  lines.push('');
  lines.push('Each fold is 252 US sessions, stepped forward 126 sessions. SMA and momentum lengths were not refit. Slot rules were chosen after scoring this history, including folds that overlap the reserved window: Trend yields only after a second failed session and a stronger incoming name, Dip has no time stop, a new Dip must have been a dip on the prior session including a held fallback, a recovered Dip yields only to a stronger new dip, and the weakest new Dip that day does not take a slot.');
  lines.push('');
  lines.push(foldTable(result.folds, names));
  lines.push('');
  lines.push('## Regime');
  lines.push('');
  lines.push(`A session is an uptrend when the latest ${bench} close is above its own 200-day average, and a downtrend when it is not. Sessions before that average exists are warmup. The return is the compounded book return on the sessions in that bucket. It describes the path. It is not a rule the books trade.`);
  lines.push('');
  lines.push(regimeTable(result.regimes, names));
  lines.push('');
  lines.push(...dataSection(result));
  lines.push('## Rules and fill');
  lines.push('');
  lines.push(`Trend holds ${15} names. Dip holds ${10}. A live Trend name keeps its slot; extra Trend signals wait and do not push out a name that still qualifies. A Trend name that no longer qualifies is sold only after it has also failed on the prior session and a new trend with stronger 12-to-1 momentum needs that slot, and the oldest weaker holding is the one sold. A one-session fail stays. A weaker new trend waits. Dip keeps an unrepaired dip. A new Dip must have been a dip on the prior session, including a held fallback that would otherwise promote. When several new dips are waiting, the weakest that day does not take a slot. A recovered Dip name is sold only when a two-session dip with stronger 12-to-1 momentum needs that slot. Empty slots are filled from the fallback list, most traded first. Control buys all ${BASKET.length} names in equal dollars on the first session and is not traded again.`);
  lines.push(`Signal: close above the ${SMA_LONG}-day simple moving average, and a positive trailing ${MOMENTUM_LOOKBACK}-trading-day return that skips the latest ${MOMENTUM_SKIP} trading days (\`close[t-${MOMENTUM_SKIP}] / close[t-${MOMENTUM_SKIP + MOMENTUM_LOOKBACK}] - 1\`). Dip also requires the close below the ${SMA_SHORT}-day average, and that this was already true on the prior session. Trend sells a held name only after a second failed session and a new trend with stronger 12-to-1 momentum needs the slot. Dip sells on a close below the ${SMA_LONG}-day average, or when the close is back above the ${SMA_SHORT}-day average and a stronger two-session dip needs the slot.`);
  lines.push(FILL_MODEL);
  lines.push(SHARPE_NOTE);
  lines.push(CAGR_NOTE);
  if (result.sample === 'yahoo-long') {
    lines.push('Yahoo bars are scaled by that session\'s adjclose/close, so splits and dividends sit inside the price. That is the analog of Alpaca `adjustment=all`. Raw and adjusted bars are not mixed. VFINX is a US mutual fund; Yahoo often prints the same NAV on open, high, low, and close. The simulated buy still uses that session\'s open, which equals the NAV on those bars.');
  } else {
    lines.push('Daily bars use `adjustment=all` for the US names: splits, cash dividends, and spin-offs. Raw and adjusted bars are not mixed. VUAA is accumulating and already in USD, so no dividend or currency is added on top of its closes.');
  }
  lines.push('');
  lines.push('Fallback list, fixed from median dollar volume over the 252 sessions ending 9 October 2026:');
  lines.push('');
  lines.push(FALLBACK.map((symbol, index) => `${index + 1}. ${symbol}`).join(', ') + '.');
  lines.push('');
  lines.push('## Skips');
  lines.push('');
  for (const name of ['Trend', 'Dip', 'Control']) {
    const skipped = result.series[name].skipped;
    const blocked = result.series[name].blocked;
    const text = Object.entries(skipped).map(([reason, count]) => `${reason} ${count}`).join(', ') || 'none';
    lines.push(`${name}: blocked sessions ${blocked}; skips: ${text}. Ending positions ${result.series[name].positions}, cash ${formatUsd(result.series[name].cash)}.`);
  }
  lines.push('');
  lines.push(...limitationsSection(result));
  return `${lines.join('\n')}\n`;
}

export function renderCombinedReport(paper, longSample) {
  const paperText = renderReport(paper).trimEnd();
  if (!longSample) return `${paperText}\n`;
  const longBody = renderLongChapter(longSample);
  return `${paperText}\n\n${longBody}\n`;
}

function renderLongChapter(result) {
  const bench = marketName(result);
  const names = namesOf(result);
  const lines = [];
  lines.push('# Long Yahoo sample');
  lines.push('');
  lines.push(`This is a second research sample. It is not the paper comparison. US bars and the market series both come from Yahoo Finance. The market series is ${bench}, the Vanguard 500 Index Investor fund, because VUAA listed on 16 May 2019 and cannot cover 2008. ${bench} is not VUAA and not SPY. Alpaca SIP bars are not mixed into this sample.`);
  lines.push('');
  lines.push(`Comparison: ${result.comparisonStart} through ${result.comparisonEnd} (${result.sessions} US sessions). Starting capital: ${formatUsd(result.capital)}.`);
  lines.push(`Control bought ${result.presentAtStart.length} of ${BASKET.length} names on that start session. The rest of the 1/${BASKET.length} slices stayed in cash for the whole sample. Those missing names: ${result.missingAtStart.join(', ') || 'none'}.`);
  lines.push('');
  lines.push('The tables use the same books and the same fill model as the paper-aligned sample. Crash windows describe the path. They are not a reason to change a rule.');
  lines.push('');
  lines.push('## Crash and bull windows');
  lines.push('');
  lines.push('Peak-to-trough dates are S&P 500 highs and lows: 9 October 2007 to 9 March 2009, and 19 February 2020 to 23 March 2020. Returns are the book\'s equity change across sessions in that window, after the base cost.');
  lines.push('');
  lines.push(windowReturnTable(result.events, names));
  lines.push('');
  lines.push(windowDrawdownTable(result.events, names));
  lines.push('');
  lines.push('## NBER recessions and expansions');
  lines.push('');
  lines.push('A second cut on NBER US recession dates. The 2020 recession is six weeks. CAGR on a window that short is not useful; the table shows total return and max drawdown.');
  lines.push('');
  lines.push(windowReturnTable(result.nber, names));
  lines.push('');
  lines.push(windowDrawdownTable(result.nber, names));
  lines.push('');
  lines.push('## Full long sample, after the base cost');
  lines.push('');
  lines.push(metricsTable(result.series));
  lines.push('');
  lines.push('## Gross, net, and pessimistic');
  lines.push('');
  lines.push(row(['Series', 'Gross CAGR', 'Net CAGR', 'Pessimistic CAGR', 'Net max drawdown']));
  lines.push(row(['---', '---', '---', '---', '---']));
  for (const name of names) {
    lines.push(row([
      name,
      formatPct(result.gross[name].cagr),
      formatPct(result.series[name].summary.cagr),
      formatPct(result.pessimistic[name].cagr),
      formatPct(result.series[name].summary.maxDrawdown),
    ]));
  }
  lines.push('');
  lines.push(COST_NOTE);
  lines.push('');
  lines.push('## Out of sample and development');
  lines.push('');
  lines.push(`Development is ${result.comparisonStart} through ${result.developmentEnd}. That window includes the 2008 crash. The reserved out-of-sample years still start at ${result.oosStart}.`);
  lines.push('');
  lines.push(`This 2022–2026 slice is not a rerun of the paper-aligned out-of-sample window. The books here opened on ${result.comparisonStart} and were still held at ${result.oosStart}. Control never rebalanced, so by then it is no longer an equal-weight basket.`);
  if (result.controlOosWeights?.names?.length) {
    const top = result.controlOosWeights.names.slice(0, 4)
      .map((row) => `${row.symbol} ${formatPct(row.weight)}`)
      .join(', ');
    lines.push(`Control weights on ${result.controlOosWeights.date}: ${top}. Cash ${formatPct(result.controlOosWeights.cashWeight)}. A paper Control that opens in 2019 is a different book, and that is the one the Answers table uses.`);
  }
  lines.push('');
  lines.push(metricsTable(Object.fromEntries(result.devRows.map((entry) => [entry.name, { summary: entry.summary }])), { activity: false }));
  lines.push('');
  lines.push(metricsTable(Object.fromEntries(result.oosRows.map((entry) => [entry.name, { summary: entry.summary }])), { activity: false }));
  lines.push('');
  lines.push('## Calendar year');
  lines.push('');
  lines.push(yearTable(result.yearly, names));
  lines.push('');
  lines.push('## SMA-200 regime');
  lines.push('');
  lines.push(`A session is an uptrend when the latest ${bench} close is above its own 200-day average, and a downtrend when it is not. This is not a rule the books trade.`);
  lines.push('');
  lines.push(regimeTable(result.regimes, names));
  lines.push('');
  lines.push(...dataSection(result));
  lines.push('## Skips');
  lines.push('');
  for (const name of ['Trend', 'Dip', 'Control']) {
    const skipped = result.series[name].skipped;
    const blocked = result.series[name].blocked;
    const text = Object.entries(skipped).map(([reason, count]) => `${reason} ${count}`).join(', ') || 'none';
    lines.push(`${name}: blocked sessions ${blocked}; skips: ${text}. Ending positions ${result.series[name].positions}, cash ${formatUsd(result.series[name].cash)}.`);
  }
  lines.push('');
  lines.push(...limitationsSection(result));
  return lines.join('\n');
}

function crashBullSections(result) {
  if (!result.events) return [];
  const names = namesOf(result);
  const overlapping = (result.events.Trend || []).filter((entry) => entry.overlaps);
  if (overlapping.length === 0) return [];
  return [
    '## Crash and bull windows',
    '',
    'Peak-to-trough dates are S&P 500 highs and lows. Returns are the book\'s equity change across sessions in that window, after the base cost. A window that starts before this sample is clipped to the comparison start.',
    '',
    windowReturnTable(result.events, names),
    '',
    windowDrawdownTable(result.events, names),
    '',
  ];
}

function dataSection(result) {
  const bench = marketName(result);
  const lines = [];
  lines.push('## Data');
  lines.push('');
  if (result.sample === 'yahoo-long') {
    lines.push(`US bars: Yahoo Finance chart API \`${result.usMeta.endpoint}\`, interval 1d, adjustment ${result.usMeta.adjustment}, start ${result.usMeta.start}, end ${result.usMeta.end}. Fetched ${result.usMeta.fetched_at}.`);
    lines.push(`First US bar returned: ${result.firstUs}. Last US bar returned: ${result.lastUs}.`);
    lines.push('Sessions are the AAPL dates in that cache. Yahoo \`BRK.B\` is requested as \`BRK-B\` and stored under the basket name.');
    lines.push(`Comparison start is the first US session on or after ${result.comparisonStart === result.firstBenchmark ? `the first ${bench} bar` : '3 January 2006'} that also has a warmed-up signal. Actual start: ${result.comparisonStart}. Last common session: ${result.comparisonEnd}.`);
    lines.push(`${bench} source: ${result.vuaaMeta.source}, ${result.vuaaMeta.symbol}, ${result.vuaaMeta.name || 'Vanguard 500 Index Investor'}, currency ${result.vuaaMeta.currency}, adjustment ${result.vuaaMeta.adjustment}, ${result.vuaaBarCount} bars, ${result.firstBenchmark} through ${result.lastBenchmark}.`);
    lines.push(`${bench} is a mutual-fund share class, not an ETF. Yahoo adjclose includes dividend reinvestment, which is the analog of VUAA accumulating. Expense ratio history is inside that series. It is not the official S&P 500 total-return index.`);
    lines.push(`${bench} closes were carried across ${result.vuaaCarriedSessions} US sessions with no bar. No return was invented on those sessions; the previous close was reused.`);
  } else {
    lines.push(`US bars: Alpaca \`GET ${result.usMeta.endpoint}\` with \`timeframe=${result.usMeta.timeframe}\`, \`feed=${result.usMeta.feed}\`, \`adjustment=${result.usMeta.adjustment}\`, start ${result.usMeta.start}, end ${result.usMeta.end}. Fetched ${result.usMeta.fetched_at}.`);
    lines.push(`First US bar returned: ${result.firstUs}. Last US bar returned: ${result.lastUs}.`);
    lines.push(`Sessions are the AAPL dates in that cache. History on this free plan starts in 2016. This is not a 15–20 year sample.`);
    lines.push(`Comparison start is the first US session on or after ${result.comparisonStart === result.firstVuaa ? 'the first VUAA bar' : '16 May 2019'} that also has a warmed-up signal. Actual start: ${result.comparisonStart}. Last common session: ${result.comparisonEnd}.`);
    lines.push(`VUAA source: ${result.vuaaMeta.source}, ${result.vuaaMeta.symbol}, ISIN ${result.vuaaMeta.isin}, currency ${result.vuaaMeta.currency}, adjustment ${result.vuaaMeta.adjustment}, ${result.vuaaBarCount} bars, ${result.firstVuaa} through ${result.lastVuaa}.`);
    if (result.vuaaMeta.repaired) {
      lines.push(`Yahoo printed ${result.vuaaMeta.repaired} VUAA bars whose high or low did not contain the close. Those bars were kept. The high and low were expanded to the close, and the close itself was not changed. ${result.vuaaMeta.dropped || 0} VUAA bars were dropped.`);
    }
    lines.push('VUAA was not requested from `feed=sip`. It is the London USD accumulating listing, not VUAG and not SPY.');
    lines.push(`VUAA closes were carried across ${result.vuaaCarriedSessions} US sessions with no London bar. No return was invented on those sessions; the previous close was reused.`);
  }
  lines.push(`Control carried a held close on ${result.controlCarriedSessions} sessions where at least one held name had no bar.`);
  if (result.controlMissing.length) {
    lines.push(`Control left cash for names with no open on the comparison start: ${result.controlMissing.join(', ')}.`);
  } else {
    lines.push('Control bought every basket name on the comparison start.');
  }
  if (result.sample === 'yahoo-long') {
    for (const note of Object.values(YAHOO_HISTORY_NOTES)) lines.push(note);
  }
  lines.push('');
  lines.push('### Bars by name');
  lines.push('');
  lines.push(row(['Symbol', 'Bars', 'First', 'Last', 'Missing sessions inside its span']));
  lines.push(row(['---', '---', '---', '---', '---']));
  for (const gap of result.gaps) {
    lines.push(row([gap.symbol, String(gap.bars), gap.first || 'n/a', gap.last || 'n/a', gap.missing == null ? 'n/a' : String(gap.missing)]));
  }
  lines.push('');
  return lines;
}

function limitationsSection(result) {
  const lines = ['## Limitations', ''];
  lines.push('The basket is a fixed list of today\'s names. There is no point-in-time membership, so every result is survivorship-biased and is not reliable evidence.');
  if (result.sample === 'yahoo-long') {
    lines.push('The long sample starts in 2006 because Yahoo has those bars, not because the paper books traded then. Many of today\'s names did not exist in 2008. Control leaves those slices in cash. Trend and Dip skip a fallback with no bar.');
    lines.push('Yahoo maps a current ticker onto whatever series it has, including reverse-merger predecessors. That is not the same as Alpaca SIP `asof` history, and it is not mixed with it.');
    lines.push('VFINX is a stand-in for a Vanguard S&P 500 accumulating vehicle before VUAA listed. Do not read a VFINX result as a VUAA result, and do not read it as SPY.');
    lines.push('Daily equity for this sample is in `reports/equity-long.csv`.');
  } else {
    lines.push('The sample begins in 2016. US sessions before the first VUAA bar warm up the averages and stay out of the comparison. Do not read this as a test of history before 2016, or as a 15–20 year test.');
    lines.push('A name that no longer trades is simply absent. Nothing was filled in from a second US vendor for this paper-aligned sample.');
    lines.push('Daily equity for all four series is in `reports/equity.csv`.');
  }
  lines.push('The flat cost is not a measured spread. Paper fills are not evidence of live execution. SMA and momentum lengths were not grid-searched. The slot rules above were chosen after scoring this historical dataset, so the reserved four-year window is no longer an untouched out-of-sample test of those rules.');
  lines.push('');
  return lines;
}

function metricsTable(series, { activity = true } = {}) {
  const header = ['Series', 'Total return', 'CAGR', 'Max drawdown', 'Drawdown sessions', 'Volatility', 'Sharpe'];
  if (activity) header.push('Orders', 'Closed trades', 'Turnover');
  const lines = [row(header), row(header.map(() => '---'))];
  for (const [name, packed] of Object.entries(series)) {
    const summary = packed.summary;
    if (!summary) continue;
    const cells = [
      name,
      formatPct(summary.totalReturn),
      formatPct(summary.cagr),
      formatPct(summary.maxDrawdown),
      summary.drawdownSessions == null ? 'n/a' : String(summary.drawdownSessions),
      formatPct(summary.volatility),
      num(summary.sharpe),
    ];
    if (activity) {
      cells.push(
        packed.fills == null ? 'n/a' : String(packed.fills),
        summary.trades == null ? 'n/a' : String(summary.trades),
        formatPct(summary.turnover),
      );
    }
    lines.push(row(cells));
  }
  return lines.join('\n');
}

function differenceTable(series) {
  const names = Object.keys(series);
  const lines = [row(['', ...names]), row(['---', ...names.map(() => '---')])];
  for (const rowName of names) {
    lines.push(row([
      rowName,
      ...names.map((column) => formatPct(series[rowName].summary.totalReturn - series[column].summary.totalReturn)),
    ]));
  }
  return lines.join('\n');
}

function yearTable(yearly, names) {
  const years = yearly.Trend.map((entry) => entry.year);
  const lines = [row(['Year', ...names]), row(['---', ...names.map(() => '---')])];
  for (const year of years) {
    lines.push(row([
      year,
      ...names.map((name) => formatPct(yearly[name].find((entry) => entry.year === year)?.totalReturn)),
    ]));
  }
  return lines.join('\n');
}

function foldTable(folds, names) {
  const lines = [row(['Fold', ...names]), row(['---', ...names.map(() => '---')])];
  const count = folds.Trend.length;
  for (let i = 0; i < count; i++) {
    const label = `${folds.Trend[i].from} to ${folds.Trend[i].to}`;
    lines.push(row([
      label,
      ...names.map((name) => formatPct(folds[name][i].totalReturn)),
    ]));
  }
  return lines.join('\n');
}

function regimeTable(regimes, names) {
  const header = ['Regime', 'Sessions', ...names];
  const lines = [row(header), row(header.map(() => '---'))];
  for (const regime of ['uptrend', 'downtrend', 'warmup']) {
    lines.push(row([
      regime,
      String(regimes.Trend[regime].sessions),
      ...names.map((name) => formatPct(regimes[name][regime].totalReturn)),
    ]));
  }
  return lines.join('\n');
}

function overlappingWindows(events) {
  return (events.Trend || []).filter((entry) => entry.overlaps && entry.summary);
}

function windowOf(events, name, id) {
  return (events[name] || []).find((entry) => entry.id === id);
}

function windowReturnTable(events, names) {
  const windows = overlappingWindows(events);
  if (windows.length === 0) return 'No named window overlaps this sample.';
  const header = ['Window', 'Kind', 'First', 'Last', 'Sessions', ...names];
  const lines = [row(header), row(header.map(() => '---'))];
  for (const trend of windows) {
    lines.push(row([
      trend.label,
      trend.kind,
      trend.from,
      trend.to,
      String(trend.summary.observations),
      ...names.map((name) => formatPct(windowOf(events, name, trend.id)?.summary?.totalReturn)),
    ]));
  }
  return lines.join('\n');
}

function windowDrawdownTable(events, names) {
  const windows = overlappingWindows(events);
  if (windows.length === 0) return '';
  const header = ['Window', ...names.map((name) => `${name} max DD`)];
  const lines = [row(header), row(header.map(() => '---'))];
  for (const trend of windows) {
    lines.push(row([
      trend.label,
      ...names.map((name) => formatPct(windowOf(events, name, trend.id)?.summary?.maxDrawdown)),
    ]));
  }
  return lines.join('\n');
}

export function renderEquityCsv(curves, columns = [
  ['trend', 'Trend'],
  ['dip', 'Dip'],
  ['control', 'Control'],
  ['vuaa', 'VUAA'],
]) {
  const lead = columns[0][1];
  const dates = curves[lead].map((point) => point.date);
  const byDate = Object.fromEntries(columns.map(([, name]) => [name, new Map(curves[name].map((point) => [point.date, point.equity]))]));
  const lines = [`date,${columns.map(([key]) => key).join(',')}`];
  for (const date of dates) {
    lines.push([date, ...columns.map(([, name]) => byDate[name].get(date))].join(','));
  }
  return `${lines.join('\n')}\n`;
}
