# Basket books

Trend, Dip, and Control are simulated on the same sessions and the same $5,000. VUAA is a fourth series and is not a book.

## Answers

Out-of-sample window: 2022-10-12 through 2026-10-12.
A selection edge means the book beat Control after costs in that window. A market edge means it beat VUAA after costs in that window. One window is not enough to accept either.

| Book | Out-of-sample return | Selection edge | Market edge |
| --- | --- | --- | --- |
| Trend | 550.00% | yes | yes |
| Dip | 1072.29% | yes | yes |
| Control | 264.10% | n/a | yes |

These are the results of the fixed rules on this one window. They are not a decision to keep or drop a book.

## Full sample, after the base cost

| Series | Total return | CAGR | Max drawdown | Drawdown sessions | Volatility | Sharpe | Orders | Closed trades | Turnover |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Trend | 627.25% | 30.71% | -34.51% | 469 | 31.04% | 1.02 | 383 | 184 | 139.85% |
| Dip | 1442.22% | 44.67% | -37.11% | 491 | 33.16% | 1.28 | 1092 | 541 | 468.60% |
| Control | 345.33% | 22.34% | -32.09% | 414 | 21.18% | 1.06 | 25 | 0 | 2.41% |
| VUAA | 199.83% | 15.98% | -34.05% | 121 | 17.51% | 0.94 | 1 | 0 | 3.85% |

Comparison: 2019-05-16 through 2026-10-12 (1862 US sessions).
Starting capital: $5000.00.

## Gross, net, and pessimistic

| Series | Gross CAGR | Net CAGR | Pessimistic CAGR | Net max drawdown |
| --- | --- | --- | --- | --- |
| Trend | 30.96% | 30.71% | 29.97% | -34.51% |
| Dip | 45.63% | 44.67% | 41.81% | -37.11% |
| Control | 22.34% | 22.34% | 22.31% | -32.09% |
| VUAA | 15.98% | 15.98% | 15.95% | -34.05% |

Base cost is 5 bps of notional on every simulated fill. The pessimistic case uses 20 bps. These are flat assumptions. The backtest does not replay quotes. The paper job logs the session opening SIP quote separately and does not feed that quote back into these books.

## Out of sample and development

Development is 2019-05-16 through 2022-10-11. That window is short, and it is the only history available before the reserved out-of-sample years.

| Series | Total return | CAGR | Max drawdown | Drawdown sessions | Volatility | Sharpe |
| --- | --- | --- | --- | --- | --- | --- |
| Trend | 11.89% | 3.35% | -34.51% | 199 | 27.79% | 0.26 |
| Dip | 31.56% | 8.39% | -37.11% | 223 | 29.26% | 0.42 |
| Control | 22.31% | 6.09% | -32.09% | 223 | 20.74% | 0.39 |
| VUAA | 32.49% | 8.61% | -34.05% | 121 | 20.67% | 0.50 |

| Series | Total return | CAGR | Max drawdown | Drawdown sessions | Volatility | Sharpe |
| --- | --- | --- | --- | --- | --- | --- |
| Trend | 550.00% | 59.67% | -33.97% | 94 | 33.53% | 1.57 |
| Dip | 1072.29% | 85.04% | -32.36% | 63 | 36.10% | 1.89 |
| Control | 264.10% | 38.14% | -24.29% | 86 | 21.53% | 1.62 |
| VUAA | 126.30% | 22.65% | -18.39% | 88 | 14.25% | 1.51 |

## Each series against the others

Difference in full-sample total return (row minus column), after the base cost.

|  | Trend | Dip | Control | VUAA |
| --- | --- | --- | --- | --- |
| Trend | 0.00% | -814.97% | 281.92% | 427.42% |
| Dip | 814.97% | 0.00% | 1096.89% | 1242.39% |
| Control | -281.92% | -1096.89% | 0.00% | 145.50% |
| VUAA | -427.42% | -1242.39% | -145.50% | 0.00% |

## Calendar year

| Year | Trend | Dip | Control | VUAA |
| --- | --- | --- | --- | --- |
| 2019 | 8.07% | 9.70% | 6.28% | 13.92% |
| 2020 | 31.29% | 48.67% | 32.17% | 17.66% |
| 2021 | 17.42% | 14.52% | 25.42% | 29.34% |
| 2022 | -27.28% | -29.19% | -24.96% | -18.63% |
| 2023 | 53.66% | 64.29% | 42.70% | 26.68% |
| 2024 | 64.09% | 111.56% | 53.81% | 25.27% |
| 2025 | 31.53% | 87.87% | 22.38% | 17.37% |
| 2026 | 81.00% | 78.58% | 25.39% | 14.11% |

## Crash and bull windows

Peak-to-trough dates are S&P 500 highs and lows. Returns are the book's equity change across sessions in that window, after the base cost. A window that starts before this sample is clipped to the comparison start.

| Window | Kind | First | Last | Sessions | Trend | Dip | Control | VUAA |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Post-GFC bull | bull | 2019-05-16 | 2020-02-19 | 192 | 15.53% | 17.97% | 12.31% | 20.17% |
| COVID peak to trough | crash | 2020-02-20 | 2020-03-23 | 23 | -32.80% | -26.64% | -24.07% | -34.05% |
| Post-COVID bull | bull | 2020-03-24 | 2026-10-12 | 1647 | 836.74% | 1682.13% | 422.22% | 278.34% |

| Window | Trend max DD | Dip max DD | Control max DD | VUAA max DD |
| --- | --- | --- | --- | --- |
| Post-GFC bull | -9.51% | -9.04% | -8.19% | -5.78% |
| COVID peak to trough | -32.80% | -29.73% | -24.07% | -34.05% |
| Post-COVID bull | -34.51% | -37.11% | -32.09% | -24.36% |

## Walk-forward

Each fold is 252 US sessions, stepped forward 126 sessions. SMA and momentum lengths were not refit. Slot rules were chosen after scoring this history, including folds that overlap the reserved window: Trend yields only after a second failed session and a stronger incoming name, Dip has no time stop, a new Dip must have been a dip on the prior session including a held fallback, a recovered Dip yields only to a stronger new dip, and the weakest new Dip that day does not take a slot.

| Fold | Trend | Dip | Control | VUAA |
| --- | --- | --- | --- | --- |
| 2019-05-16 to 2020-05-14 | -4.41% | 9.30% | -0.22% | -0.13% |
| 2019-11-13 to 2020-11-11 | 27.79% | 45.78% | 27.69% | 17.02% |
| 2020-05-15 to 2021-05-14 | 59.75% | 67.60% | 50.74% | 50.36% |
| 2020-11-12 to 2021-11-11 | 27.14% | 28.37% | 35.06% | 31.88% |
| 2021-05-17 to 2022-05-13 | -18.63% | -20.66% | -7.72% | -2.27% |
| 2021-11-12 to 2022-11-11 | -22.64% | -23.48% | -21.46% | -13.96% |
| 2022-05-16 to 2023-05-16 | 9.77% | 7.42% | 10.07% | 3.99% |
| 2022-11-14 to 2023-11-14 | 39.86% | 42.94% | 31.36% | 15.57% |
| 2023-05-17 to 2024-05-16 | 75.30% | 78.19% | 58.10% | 30.78% |
| 2023-11-15 to 2024-11-14 | 66.35% | 100.29% | 65.69% | 34.17% |
| 2024-05-17 to 2025-05-20 | 42.78% | 128.20% | 25.50% | 12.87% |
| 2024-11-15 to 2025-11-18 | 30.47% | 90.82% | 16.01% | 12.09% |
| 2025-05-21 to 2026-05-21 | 96.47% | 136.65% | 33.25% | 25.70% |
| 2025-11-19 to 2026-10-12 | 86.11% | 90.10% | 27.38% | 18.75% |

## Regime

A session is an uptrend when the latest VUAA close is above its own 200-day average, and a downtrend when it is not. Sessions before that average exists are warmup. The return is the compounded book return on the sessions in that bucket. It describes the path. It is not a rule the books trade.

| Regime | Sessions | Trend | Dip | Control | VUAA |
| --- | --- | --- | --- | --- | --- |
| uptrend | 1333 | 664.72% | 1170.76% | 348.41% | 285.21% |
| downtrend | 335 | -15.62% | 4.81% | -10.23% | -34.36% |
| warmup | 194 | 12.71% | 15.79% | 10.63% | 18.57% |

## Data

US bars: Alpaca `GET https://data.alpaca.markets/v2/stocks/bars` with `timeframe=1Day`, `feed=sip`, `adjustment=all`, start 2016-01-01, end 2026-10-12T21:04:55.521Z. Fetched 2026-10-12T21:25:02.551Z.
First US bar returned: 2016-01-04. Last US bar returned: 2026-10-12.
Sessions are the AAPL dates in that cache. History on this free plan starts in 2016. This is not a 15–20 year sample.
Comparison start is the first US session on or after 16 May 2019 that also has a warmed-up signal. Actual start: 2019-05-16. Last common session: 2026-10-12.
VUAA source: yahoo-finance-chart, VUAA.L, ISIN IE00BFMXXD54, currency USD, adjustment yahoo-adjclose-scaled, 1873 bars, 2019-05-14 through 2026-10-12.
VUAA was not requested from `feed=sip`. It is the London USD accumulating listing, not VUAG and not SPY.
VUAA closes were carried across 36 US sessions with no London bar. No return was invented on those sessions; the previous close was reused.
Control carried a held close on 0 sessions where at least one held name had no bar.
Control left cash for names with no open on the comparison start: FIG, SNDK, HOOD, DDOG, ABNB, RDDT, PLTR, SKYD, SPCX.

### Bars by name

| Symbol | Bars | First | Last | Missing sessions inside its span |
| --- | --- | --- | --- | --- |
| AAPL | 2709 | 2016-01-04 | 2026-10-12 | 0 |
| ABNB | 1465 | 2020-12-10 | 2026-10-12 | 0 |
| ADBE | 2709 | 2016-01-04 | 2026-10-12 | 0 |
| ADSK | 2709 | 2016-01-04 | 2026-10-12 | 0 |
| AMZN | 2709 | 2016-01-04 | 2026-10-12 | 0 |
| BRK.B | 2709 | 2016-01-04 | 2026-10-12 | 0 |
| DDOG | 1775 | 2019-09-19 | 2026-10-12 | 0 |
| DE | 2709 | 2016-01-04 | 2026-10-12 | 0 |
| DELL | 1957 | 2018-12-28 | 2026-10-12 | 0 |
| DIS | 2709 | 2016-01-04 | 2026-10-12 | 0 |
| EBAY | 2709 | 2016-01-04 | 2026-10-12 | 0 |
| F | 2709 | 2016-01-04 | 2026-10-12 | 0 |
| FIG | 302 | 2025-07-31 | 2026-10-12 | 0 |
| GOOGL | 2709 | 2016-01-04 | 2026-10-12 | 0 |
| GRMN | 2709 | 2016-01-04 | 2026-10-12 | 0 |
| HOOD | 1307 | 2021-07-29 | 2026-10-12 | 0 |
| HPQ | 2709 | 2016-01-04 | 2026-10-12 | 0 |
| IBKR | 2709 | 2016-01-04 | 2026-10-12 | 0 |
| IBM | 2709 | 2016-01-04 | 2026-10-12 | 0 |
| MAR | 2709 | 2016-01-04 | 2026-10-12 | 0 |
| NFLX | 2709 | 2016-01-04 | 2026-10-12 | 0 |
| NKE | 2709 | 2016-01-04 | 2026-10-12 | 0 |
| NVDA | 2709 | 2016-01-04 | 2026-10-12 | 0 |
| PFE | 2709 | 2016-01-04 | 2026-10-12 | 0 |
| PLTR | 1515 | 2020-09-30 | 2026-10-12 | 0 |
| RACE | 2709 | 2016-01-04 | 2026-10-12 | 0 |
| RDDT | 642 | 2024-03-21 | 2026-10-12 | 0 |
| RL | 2709 | 2016-01-04 | 2026-10-12 | 0 |
| SKYD | 297 | 2025-08-07 | 2026-10-12 | 0 |
| SNDK | 417 | 2025-02-13 | 2026-10-12 | 0 |
| SPCX | 84 | 2026-06-12 | 2026-10-12 | 0 |
| SPOT | 2144 | 2018-04-03 | 2026-10-12 | 0 |
| UBER | 1866 | 2019-05-10 | 2026-10-12 | 0 |
| UPS | 2709 | 2016-01-04 | 2026-10-12 | 0 |

## Rules and fill

Trend holds 15 names. Dip holds 10. A live Trend name keeps its slot; extra Trend signals wait and do not push out a name that still qualifies. A Trend name that no longer qualifies is sold only after it has also failed on the prior session and a new trend with stronger 12-to-1 momentum needs that slot, and the oldest weaker holding is the one sold. A one-session fail stays. A weaker new trend waits. Dip keeps an unrepaired dip. A new Dip must have been a dip on the prior session, including a held fallback that would otherwise promote. When several new dips are waiting, the weakest that day does not take a slot. A recovered Dip name is sold only when a two-session dip with stronger 12-to-1 momentum needs that slot. Empty slots are filled from the fallback list, most traded first. Control buys all 34 names in equal dollars on the first session and is not traded again.
Signal: close above the 200-day simple moving average, and a positive trailing 126-trading-day return that skips the latest 21 trading days (`close[t-21] / close[t-147] - 1`). Dip also requires the close below the 20-day average, and that this was already true on the prior session. Trend sells a held name only after a second failed session and a new trend with stronger 12-to-1 momentum needs the slot. Dip sells on a close below the 200-day average, or when the close is back above the 20-day average and a stronger two-session dip needs the slot.
A signal is computed from completed daily bars. The earliest fill is the next regular session, at that session's open. The cost rate is taken out of the buy budget and out of sell proceeds. A missing open skips that name. On the opening session the skipped slot is filled from the next eligible name at the same dollar amount. A paired buy after that is sized from the paired sale's proceeds.
Sharpe uses close-to-close returns, a risk-free rate of 0, and the sample standard deviation (n − 1). It is annualized with the square root of 252. It is not excess over Treasury bills.
CAGR is ending equity divided by the equity at the start of the window, raised to 365.25 divided by the calendar days between the first and last session, minus one.
Daily bars use `adjustment=all` for the US names: splits, cash dividends, and spin-offs. Raw and adjusted bars are not mixed. VUAA is accumulating and already in USD, so no dividend or currency is added on top of its closes.

Fallback list, fixed from median dollar volume over the 252 sessions ending 9 October 2026:

1. NVDA, 2. SNDK, 3. AAPL, 4. SPCX, 5. AMZN, 6. GOOGL, 7. PLTR, 8. NFLX, 9. HOOD, 10. BRK.B, 11. IBM, 12. DELL, 13. UBER, 14. ADBE, 15. PFE.

## Skips

Trend: blocked sessions 0; skips: no_bar_on_execution_session 1. Ending positions 15, cash $0.05.
Dip: blocked sessions 0; skips: no_bar_on_execution_session 147, slot_left_in_cash 3. Ending positions 10, cash $142.56.
Control: blocked sessions 0; skips: none. Ending positions 25, cash $1323.75.

## Limitations

The basket is a fixed list of today's names. There is no point-in-time membership, so every result is survivorship-biased and is not reliable evidence.
The sample begins in 2016. US sessions before the first VUAA bar warm up the averages and stay out of the comparison. Do not read this as a test of history before 2016, or as a 15–20 year test.
A name that no longer trades is simply absent. Nothing was filled in from a second US vendor for this paper-aligned sample.
Daily equity for all four series is in `reports/equity.csv`.
The flat cost is not a measured spread. Paper fills are not evidence of live execution. SMA and momentum lengths were not grid-searched. The slot rules above were chosen after scoring this historical dataset, so the reserved four-year window is no longer an untouched out-of-sample test of those rules.

# Long Yahoo sample

This is a second research sample. It is not the paper comparison. US bars and the market series both come from Yahoo Finance. The market series is VFINX, the Vanguard 500 Index Investor fund, because VUAA listed on 16 May 2019 and cannot cover 2008. VFINX is not VUAA and not SPY. Alpaca SIP bars are not mixed into this sample.

Comparison: 2006-01-03 through 2026-10-12 (5226 US sessions). Starting capital: $5000.00.
Control bought 21 of 34 names on that start session. The rest of the 1/34 slices stayed in cash for the whole sample. Those missing names: SPOT, FIG, RACE, SNDK, UBER, DELL, HOOD, DDOG, ABNB, IBKR, RDDT, PLTR, SPCX.

The tables use the same books and the same fill model as the paper-aligned sample. Crash windows describe the path. They are not a reason to change a rule.

## Crash and bull windows

Peak-to-trough dates are S&P 500 highs and lows: 9 October 2007 to 9 March 2009, and 19 February 2020 to 23 March 2020. Returns are the book's equity change across sessions in that window, after the base cost.

| Window | Kind | First | Last | Sessions | Trend | Dip | Control | VFINX |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Pre-GFC bull | bull | 2006-01-03 | 2007-10-09 | 445 | 62.24% | 70.61% | 36.49% | 27.17% |
| GFC peak to trough | crash | 2007-10-10 | 2009-03-09 | 355 | -53.90% | -44.57% | -41.02% | -55.25% |
| Post-GFC bull | bull | 2009-03-10 | 2020-02-19 | 2756 | 1747.93% | 1258.37% | 1003.56% | 519.70% |
| COVID peak to trough | crash | 2020-02-20 | 2020-03-23 | 23 | -31.50% | -21.71% | -19.86% | -33.83% |
| Post-COVID bull | bull | 2020-03-24 | 2026-10-12 | 1647 | 1291.61% | 1304.51% | 488.68% | 280.61% |

| Window | Trend max DD | Dip max DD | Control max DD | VFINX max DD |
| --- | --- | --- | --- | --- |
| Pre-GFC bull | -13.77% | -14.81% | -8.05% | -9.28% |
| GFC peak to trough | -55.51% | -52.94% | -43.41% | -55.25% |
| Post-GFC bull | -31.14% | -24.30% | -32.25% | -19.40% |
| COVID peak to trough | -32.67% | -24.30% | -25.41% | -33.83% |
| Post-COVID bull | -40.69% | -43.66% | -47.69% | -24.59% |

## NBER recessions and expansions

A second cut on NBER US recession dates. The 2020 recession is six weeks. CAGR on a window that short is not useful; the table shows total return and max drawdown.

| Window | Kind | First | Last | Sessions | Trend | Dip | Control | VFINX |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| NBER recession 2007-09 | recession | 2007-12-03 | 2009-06-30 | 397 | -34.20% | -26.75% | -25.45% | -35.44% |
| NBER expansion 2009-20 | expansion | 2009-07-01 | 2020-01-31 | 2665 | 1152.64% | 910.16% | 710.96% | 330.64% |
| NBER recession 2020 | recession | 2020-02-03 | 2020-04-30 | 62 | -13.02% | -0.60% | 8.22% | -9.32% |
| NBER expansion 2020- | expansion | 2020-05-01 | 2026-10-12 | 1620 | 1058.16% | 1073.09% | 377.90% | 191.94% |

| Window | Trend max DD | Dip max DD | Control max DD | VFINX max DD |
| --- | --- | --- | --- | --- |
| NBER recession 2007-09 | -55.07% | -52.13% | -42.77% | -53.96% |
| NBER expansion 2009-20 | -31.14% | -24.30% | -32.25% | -19.40% |
| NBER recession 2020 | -32.67% | -24.30% | -25.41% | -33.83% |
| NBER expansion 2020- | -40.69% | -43.66% | -47.69% | -24.59% |

## Full long sample, after the base cost

| Series | Total return | CAGR | Max drawdown | Drawdown sessions | Volatility | Sharpe | Orders | Closed trades | Turnover |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Trend | 13074.56% | 26.49% | -55.51% | 622 | 27.58% | 0.99 | 809 | 397 | 123.65% |
| Dip | 14025.35% | 26.91% | -52.94% | 619 | 26.60% | 1.03 | 2682 | 1336 | 441.10% |
| Control | 4091.45% | 19.70% | -47.69% | 521 | 22.40% | 0.92 | 21 | 0 | 0.17% |
| VFINX | 788.12% | 11.09% | -55.25% | 1224 | 19.28% | 0.64 | 1 | 0 | 0.84% |

## Gross, net, and pessimistic

| Series | Gross CAGR | Net CAGR | Pessimistic CAGR | Net max drawdown |
| --- | --- | --- | --- | --- |
| Trend | 26.65% | 26.49% | 26.01% | -55.51% |
| Dip | 27.68% | 26.91% | 24.65% | -52.94% |
| Control | 19.71% | 19.70% | 19.69% | -47.69% |
| VFINX | 11.09% | 11.09% | 11.08% | -55.25% |

Base cost is 5 bps of notional on every simulated fill. The pessimistic case uses 20 bps. These are flat assumptions. The backtest does not replay quotes. The paper job logs the session opening SIP quote separately and does not feed that quote back into these books.

## Out of sample and development

Development is 2006-01-03 through 2022-10-11. That window includes the 2008 crash. The reserved out-of-sample years still start at 2022-10-12.

This 2022–2026 slice is not a rerun of the paper-aligned out-of-sample window. The books here opened on 2006-01-03 and were still held at 2022-10-12. Control never rebalanced, so by then it is no longer an equal-weight basket.
Control weights on 2022-10-12: AAPL 20.48%, NFLX 18.67%, AMZN 15.54%, NVDA 13.36%. Cash 4.25%. A paper Control that opens in 2019 is a different book, and that is the one the Answers table uses.

| Series | Total return | CAGR | Max drawdown | Drawdown sessions | Volatility | Sharpe |
| --- | --- | --- | --- | --- | --- | --- |
| Trend | 1465.87% | 17.83% | -55.51% | 622 | 24.48% | 0.79 |
| Dip | 1199.19% | 16.52% | -52.94% | 619 | 22.10% | 0.80 |
| Control | 794.82% | 13.96% | -47.69% | 223 | 20.95% | 0.73 |
| VFINX | 288.26% | 8.43% | -55.25% | 1224 | 20.10% | 0.50 |

| Series | Total return | CAGR | Max drawdown | Drawdown sessions | Volatility | Sharpe |
| --- | --- | --- | --- | --- | --- | --- |
| Trend | 741.36% | 70.31% | -40.69% | 75 | 37.89% | 1.60 |
| Dip | 987.24% | 81.59% | -43.66% | 75 | 40.28% | 1.69 |
| Control | 368.42% | 47.12% | -25.50% | 90 | 27.66% | 1.54 |
| VFINX | 128.74% | 22.98% | -18.76% | 88 | 15.34% | 1.43 |

## Calendar year

| Year | Trend | Dip | Control | VFINX |
| --- | --- | --- | --- | --- |
| 2006 | 23.55% | 20.66% | 13.39% | 13.71% |
| 2007 | 30.45% | 39.44% | 18.55% | 5.39% |
| 2008 | -43.26% | -41.28% | -33.79% | -37.02% |
| 2009 | 61.06% | 66.59% | 39.89% | 26.52% |
| 2010 | 32.65% | 20.94% | 26.48% | 14.91% |
| 2011 | -2.57% | -0.33% | -4.82% | 1.96% |
| 2012 | 17.36% | 26.06% | 15.91% | 15.82% |
| 2013 | 59.62% | 52.55% | 40.70% | 32.17% |
| 2014 | 8.25% | 4.63% | 6.33% | 13.52% |
| 2015 | 16.86% | 23.05% | 28.65% | 1.23% |
| 2016 | 60.14% | 35.49% | 13.95% | 11.83% |
| 2017 | 57.34% | 52.74% | 40.58% | 21.66% |
| 2018 | 2.37% | 7.92% | 11.41% | -4.55% |
| 2019 | 16.17% | 12.91% | 31.20% | 31.33% |
| 2020 | 23.66% | 38.60% | 60.31% | 18.20% |
| 2021 | 32.52% | 1.41% | 27.95% | 28.53% |
| 2022 | -19.18% | -26.05% | -39.45% | -18.24% |
| 2023 | 46.80% | 50.77% | 75.37% | 26.12% |
| 2024 | 77.91% | 79.50% | 81.77% | 24.84% |
| 2025 | 13.12% | 54.69% | 21.98% | 17.71% |
| 2026 | 149.13% | 162.11% | 10.86% | 14.95% |

## SMA-200 regime

A session is an uptrend when the latest VFINX close is above its own 200-day average, and a downtrend when it is not. This is not a rule the books trade.

| Regime | Sessions | Trend | Dip | Control | VFINX |
| --- | --- | --- | --- | --- | --- |
| uptrend | 4164 | 98371.37% | 75854.55% | 23555.22% | 4458.89% |
| downtrend | 1062 | -86.62% | -81.40% | -82.28% | -80.52% |
| warmup | 0 | n/a | n/a | n/a | n/a |

## Data

US bars: Yahoo Finance chart API `https://query1.finance.yahoo.com/v8/finance/chart`, interval 1d, adjustment yahoo-adjclose-scaled, start 2005-01-01, end 2026-10-13T08:17:14.952Z. Fetched 2026-10-13T08:17:14.952Z.
First US bar returned: 2005-01-03. Last US bar returned: 2026-10-12.
Sessions are the AAPL dates in that cache. Yahoo `BRK.B` is requested as `BRK-B` and stored under the basket name.
Comparison start is the first US session on or after 3 January 2006 that also has a warmed-up signal. Actual start: 2006-01-03. Last common session: 2026-10-12.
VFINX source: yahoo-finance-chart, VFINX, Vanguard 500 Index Investor, currency USD, adjustment yahoo-adjclose-scaled, 5478 bars, 2005-01-03 through 2026-10-12.
VFINX is a mutual-fund share class, not an ETF. Yahoo adjclose includes dividend reinvestment, which is the analog of VUAA accumulating. Expense ratio history is inside that series. It is not the official S&P 500 total-return index.
VFINX closes were carried across 0 US sessions with no bar. No return was invented on those sessions; the previous close was reused.
Control carried a held close on 0 sessions where at least one held name had no bar.
Control left cash for names with no open on the comparison start: SPOT, FIG, RACE, SNDK, UBER, DELL, HOOD, DDOG, ABNB, IBKR, RDDT, PLTR, SPCX.
Yahoo maps SKYD to a series from 2005. Skydance listed in 2025 via a reverse merger; that earlier history is a predecessor, not the operating company.

### Bars by name

| Symbol | Bars | First | Last | Missing sessions inside its span |
| --- | --- | --- | --- | --- |
| AAPL | 5478 | 2005-01-03 | 2026-10-12 | 0 |
| ABNB | 1465 | 2020-12-10 | 2026-10-12 | 0 |
| ADBE | 5478 | 2005-01-03 | 2026-10-12 | 0 |
| ADSK | 5478 | 2005-01-03 | 2026-10-12 | 0 |
| AMZN | 5478 | 2005-01-03 | 2026-10-12 | 0 |
| BRK.B | 5478 | 2005-01-03 | 2026-10-12 | 0 |
| DDOG | 1775 | 2019-09-19 | 2026-10-12 | 0 |
| DE | 5478 | 2005-01-03 | 2026-10-12 | 0 |
| DELL | 2552 | 2016-08-17 | 2026-10-12 | 0 |
| DIS | 5478 | 2005-01-03 | 2026-10-12 | 0 |
| EBAY | 5478 | 2005-01-03 | 2026-10-12 | 0 |
| F | 5478 | 2005-01-03 | 2026-10-12 | 0 |
| FIG | 302 | 2025-07-31 | 2026-10-12 | 0 |
| GOOGL | 5478 | 2005-01-03 | 2026-10-12 | 0 |
| GRMN | 5478 | 2005-01-03 | 2026-10-12 | 0 |
| HOOD | 1307 | 2021-07-29 | 2026-10-12 | 0 |
| HPQ | 5478 | 2005-01-03 | 2026-10-12 | 0 |
| IBKR | 4891 | 2007-05-04 | 2026-10-12 | 0 |
| IBM | 5478 | 2005-01-03 | 2026-10-12 | 0 |
| MAR | 5478 | 2005-01-03 | 2026-10-12 | 0 |
| NFLX | 5478 | 2005-01-03 | 2026-10-12 | 0 |
| NKE | 5478 | 2005-01-03 | 2026-10-12 | 0 |
| NVDA | 5478 | 2005-01-03 | 2026-10-12 | 0 |
| PFE | 5478 | 2005-01-03 | 2026-10-12 | 0 |
| PLTR | 1515 | 2020-09-30 | 2026-10-12 | 0 |
| RACE | 2759 | 2015-10-21 | 2026-10-12 | 0 |
| RDDT | 642 | 2024-03-21 | 2026-10-12 | 0 |
| RL | 5478 | 2005-01-03 | 2026-10-12 | 0 |
| SKYD | 5245 | 2005-12-05 | 2026-10-12 | 0 |
| SNDK | 417 | 2025-02-13 | 2026-10-12 | 0 |
| SPCX | 84 | 2026-06-12 | 2026-10-12 | 0 |
| SPOT | 2144 | 2018-04-03 | 2026-10-12 | 0 |
| UBER | 1866 | 2019-05-10 | 2026-10-12 | 0 |
| UPS | 5478 | 2005-01-03 | 2026-10-12 | 0 |

## Skips

Trend: blocked sessions 0; skips: none. Ending positions 15, cash $0.05.
Dip: blocked sessions 0; skips: no_bar_on_execution_session 2111, slot_left_in_cash 293. Ending positions 10, cash $11320.70.
Control: blocked sessions 0; skips: none. Ending positions 21, cash $1911.95.

## Limitations

The basket is a fixed list of today's names. There is no point-in-time membership, so every result is survivorship-biased and is not reliable evidence.
The long sample starts in 2006 because Yahoo has those bars, not because the paper books traded then. Many of today's names did not exist in 2008. Control leaves those slices in cash. Trend and Dip skip a fallback with no bar.
Yahoo maps a current ticker onto whatever series it has, including reverse-merger predecessors. That is not the same as Alpaca SIP `asof` history, and it is not mixed with it.
VFINX is a stand-in for a Vanguard S&P 500 accumulating vehicle before VUAA listed. Do not read a VFINX result as a VUAA result, and do not read it as SPY.
Daily equity for this sample is in `reports/equity-long.csv`.
The flat cost is not a measured spread. Paper fills are not evidence of live execution. SMA and momentum lengths were not grid-searched. The slot rules above were chosen after scoring this historical dataset, so the reserved four-year window is no longer an untouched out-of-sample test of those rules.

