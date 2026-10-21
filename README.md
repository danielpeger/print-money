# Basket books

Two long-only stock trading algorithms on a fixed basket of 34 US stocks, each capped at $5,000.

**Trend** holds 15 names in an uptrend. **Dip** holds 10 names that are in an uptrend and have pulled back. A third account, Control, buys the basket in equal dollars and holds. The backtest scores all three against a buy-and-hold of VUAA, an S&P 500 ETF. The same code runs the backtest and one Alpaca paper account per book.

A selection edge is an algorithm beating Control after costs, out of sample. A market edge is an algorithm beating VUAA after costs, out of sample. The report states each for a single window. One window is not enough to accept either. The paper accounts run either way.

## Books

The basket is today's names, held for the whole history.

**Trend** holds 15 names. A name qualifies when the close is above its 200-day average and the return over the prior 126 trading days, skipping the most recent 21, is positive. A name that still qualifies keeps its slot. A name that has failed for two sessions can be replaced by a new qualifier with stronger momentum.

**Dip** holds 10 names. It buys a qualifying name that has also closed below its 20-day average for two sessions. It sells when the close falls through the 200-day average, or when the pullback has repaired and a stronger two-session dip needs the slot. An unrepaired dip stays.

**Control** buys every basket name that can take a fractional order, in equal dollars, on the opening session, and then holds.

Slots that no live signal fills come from a fixed list of the 15 most traded names in the basket. That list does not refresh.

Every signal uses a completed daily close. The fill is the next regular session's open. The simulated cost is 5 basis points of notional on each fill. The report also shows 20. Each book is long only, uses no leverage, and deploys at most $5,000.

## Result

On Alpaca SIP daily bars, from 16 May 2019 through 12 October 2026, after the 5 basis point cost:

| Series | Total return | CAGR | Max drawdown | Sharpe |
| --- | ---: | ---: | ---: | ---: |
| Trend | 627.25% | 30.71% | −34.51% | 1.02 |
| Dip | 1,442.22% | 44.67% | −37.11% | 1.28 |
| Control | 345.33% | 22.34% | −32.09% | 1.06 |
| VUAA | 199.83% | 15.98% | −34.05% | 0.94 |

VUAA is the Vanguard S&P 500 UCITS ETF, USD accumulating share class. It is a backtest series. It has no paper account.

The latest four years are a reserved window. There, Trend returned 550% and Dip 1,072%, against 264% for Control and 126% for VUAA. The development window before that cut is in the same report. Trend lagged both Control and VUAA in it. The 200-day and momentum lengths were not refit. The slot rules were chosen after this history was scored, including folds that overlap the reserved window.

`reports/backtest.md` has the year-by-year path, the crash windows, and a walk-forward. It also scores a second, labeled sample: Yahoo Finance daily bars from 2006, against VFINX, so 2008 and the COVID crash are in the file. That sample stays separate from the Alpaca bars and does not feed the paper accounts.

## How a decision becomes an order

Indicators, signals, slot rules, sizing, and accounting live in plain Node modules. The backtest and the daily job import those modules. The backtest reads cached bars and does not call a broker.

US bars for the paper-aligned sample come from Alpaca's SIP daily feed, adjusted for splits, cash dividends, and spin-offs. History on the free plan starts in 2016. The comparison starts in 2019, when VUAA had listed and the signals were warm.

On weekdays, after the New York cash close, one job reads the completed session and may submit to three paper accounts, one key pair each. A second run of the same session reuses the same client order ids. The job accepts only Alpaca's paper host. A kill switch blocks new orders and leaves each book where it is.

## What this does not show

The basket is a list of names chosen today. That is survivorship bias. Several of the 34 did not exist in 2019, and Control leaves those slices in cash. The cost is a flat assumption, not a measured spread. A paper fill is not a live fill. The windows were set before the results and were not moved afterward. Nothing here is a forecast, and nothing here is a promise of profit.

## Setup

Node.js 22.

```bash
npm install
npm test
npm run backtest
```

The bar caches are already in `data/bars`. The backtest does not need API keys.

Paper trading reads `.env` and is separate from the backtest. `npm run paper:dry` calculates the orders and does not submit them.
