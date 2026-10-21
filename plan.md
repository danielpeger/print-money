# Trading Algorithm Project Plan

## 1. Project overview

Build a reproducible research and paper-trading system over one fixed basket of 34 symbols. Three paper accounts run side by side: Trend, Dip, and Control. Control holds the whole basket in equal weights. The backtest scores those same three books, plus a buy-and-hold of VUAA.

The project is primarily a technical and quantitative-research project. It asks two questions, and it does not assume either answer is yes. A selection edge means a book beats Control after costs, out of sample. A market edge means a book beats VUAA after costs, out of sample. The report states each one. One window is not enough to accept either. The paper accounts run either way.

### Constraints and decisions

- Initial capital assumption: $5,000
- Broker/API for experimentation: Alpaca.
- Research data for the US basket, paper-aligned sample: free Alpaca historical daily bars only. Do not mix a second vendor into that sample.
- Backtest-only benchmark for that sample: VUAA, the Vanguard S&P 500 UCITS ETF (USD) Accumulating, held for the same dates and the same $5,000 as the three paper books. Alpaca SIP bars do not include this London listing, so its daily bars are a separate versioned cache, and it is not a paper account. Do not substitute SPY in that sample.
- Long research sample: Yahoo Finance daily bars for the same 34 names, plus VFINX as a Vanguard S&P 500 accumulating stand-in, from 2005 so the comparison can include 2008 and COVID. That sample is labeled, is not mixed with Alpaca SIP bars, and does not feed paper trading. VFINX is not VUAA and not SPY.
- Equal-weight hold: the whole basket in equal weights, the same 34 symbols, held for those same dates and that same $5,000. This is the third paper account and one of the four backtest series.
- Trend holds 15 names. Buy the dip holds 10. Slots that are not live signals are filled from a fixed list of the 15 most traded names in the basket. The equal-weight hold buys all 34 at the start and does not use those slots.
- Research and production calculations: plain Node.js. The backtest script and the paper job import the same modules.
- First research step: run `scripts/backtest.js` and read the report it writes. That result does not gate Alpaca paper trading.
- Execution environment: Alpaca Paper Trading first; no live trading in the initial scope.
- Three paper accounts, three key pairs. Trend uses `APCA_API_KEY_ID_TREND` and `APCA_API_SECRET_KEY_TREND`. Buy the dip uses `APCA_API_KEY_ID_DIP` and `APCA_API_SECRET_KEY_DIP`. The equal-weight hold is the control account and uses `APCA_API_KEY_ID_CONTROL` and `APCA_API_SECRET_KEY_CONTROL`. `api/cron.js` sends each book's orders with that book's pair. Control submits orders only on the start session: buy all 34 in equal dollars, then hold.
- Scheduler/deployment: Vercel Cron calling one protected Node.js function, `api/cron.js`.
- Strategy evaluation: daily, after the US regular session has closed and data is finalized.
- Intended holding styles: trend entries that stay until they have failed for two sessions and a stronger new trend needs the slot, and buy-the-dip entries that wait for a two-session dip, then stay until the 200-day trend breaks or they recover and a stronger two-session dip needs the slot.
- Leverage: none.
- Short selling: none. Every book is long-only.
- Maximum drawdown: 100%.
- Paper start session: Tuesday 13 October 2026. The opening run is the evening of Monday 12 October 2026, after the scripts are finished. It reads Monday's completed bars and submits the opening orders for Tuesday's regular session. All three accounts open on that session. The paper-aligned backtest comparison start is the first session with a VUAA bar and a warmed-up signal, no earlier than 16 May 2019. The long Yahoo comparison start is the first session with a VFINX bar and a warmed-up signal, no earlier than 3 January 2006.
- A person does not place, modify, or cancel orders. The accounts change only when the job trades them. The kill switch blocks new orders. It does not sell a book.

## 2. Proposed technology stack

- Plain JavaScript modules hold every calculation: signals, sizing, risk checks, and portfolio accounting. The daily paper job and the backtest script import the same modules. No framework and no frontend. Add dependencies only when the job needs them.
- One Node.js Vercel Function, `api/cron.js`, for the daily paper-trading job.
- `scripts/backtest.js` is a separate executable. Run it with `node scripts/backtest.js`. It reads the cached bars and writes `reports/backtest.md`. It does not import `api/cron.js`, submit orders, or call Alpaca.
- `vercel.json` registers the cron. Vercel sends `GET /api/cron` to the production deployment. The schedule is `0 22 * * 1-5` (22:00 UTC, Monday–Friday).
- `CRON_SECRET` is a Vercel environment variable. The function accepts the request only when `Authorization` is `Bearer <CRON_SECRET>`. Vercel attaches that header on cron invocations.
- Supabase Postgres, written and read through the Supabase Data API (`supabase-js` inside the function), for run records, signal snapshots, target positions, order intents, a plain-language reason for every buy and sell, execution reconciliation, and spread observations.
- Alpaca Trading API for paper orders and account/position state. Paper trading uses the paper base URL. Market data uses `data.alpaca.markets`. One cron run trades three paper accounts. Trend orders use `APCA_API_KEY_ID_TREND` and `APCA_API_SECRET_KEY_TREND`. Dip orders use `APCA_API_KEY_ID_DIP` and `APCA_API_SECRET_KEY_DIP`. Control orders use `APCA_API_KEY_ID_CONTROL` and `APCA_API_SECRET_KEY_CONTROL`. The shared bar and quote fetch uses one of those paper pairs. Control holds the basket in equal weights: the cron submits its buys only on the start session, then holds.
- Vercel Cron for the daily wake-up. It runs only on the production deployment.
- Free Alpaca Market Data API only, for research and for the daily bars. Request `GET https://data.alpaca.markets/v2/stocks/bars` with `timeframe=1Day`, `feed=sip`, and `adjustment=all`. On the free Basic plan, SIP history starts in 2016, the limit is 200 calls per minute, and the latest 15 minutes of SIP are withheld. Do not use `feed=iex` for these bars: IEX history starts around 2020 and is one exchange. Cache the returned bars in a local file and version that file with the backtest.
- Automated tests for indicators, signals, sizing, risk checks, execution state transitions, and idempotency.

Do not make the strategy dependent on live order APIs. The backtest reads the cached bars. The paper job reads the same historical bars endpoint after the close, when the session is more than 15 minutes old.

## 3. Strategy hypotheses

Compare the three paper books with each other, and compare those three plus VUAA in the backtest. Do not assume any of them is profitable. There is one trend book. Its rules are fixed.

### Universe

Trend follower, buy the dip, the equal-weight hold, and the backtest all use this fixed list of 34 symbols. VUAA is the only name outside the list. Do not add or drop a basket name without changing the list.

GOOGL, AAPL, DIS, SPOT, FIG, RACE, AMZN, BRK.B, NFLX, SNDK, IBM, DE, PFE, UBER, DELL, ADBE, HOOD, DDOG, UPS, ABNB, MAR, ADSK, F, NKE, GRMN, EBAY, IBKR, HPQ, RDDT, RL, PLTR, NVDA, SKYD, SPCX

- The free Alpaca API does not provide point-in-time index membership. This list is the chosen names for the whole history. It is not an S&P 500 membership list. Label every backtest as affected by survivorship bias and do not treat its results as reliable evidence.
- Apply liquidity and data-quality filters using only information available at the time, computed from the cached daily bars.
- Handle ticker renames through Alpaca's default `asof` behavior on the historical bars endpoint. `adjustment=all` applies splits, cash dividends, and spin-offs. A name that no longer exists is missing from a list of today's symbols; record that gap. Do not fill it from another data source.

### Baseline signal

Evaluate signals once per trading day using completed daily bars:

1. Calculate a 200-trading-day simple moving average (SMA).
2. Calculate trailing 126-trading-day total return, excluding the most recent 21 trading days.
3. A stock qualifies when:
   - its latest completed close is above its 200-day SMA; and
   - its 12-to-1-month momentum return is positive.
4. Signals must only use data available at the decision timestamp.
5. The earliest eligible order execution is the next regular trading session. Never assume execution at the same close used to generate a signal.

The periods above are initial hypotheses, not optimized or established parameters. Require sufficient warm-up history before producing signals.

### What to compare

Three Alpaca paper accounts, each starting at $5,000:

1. **Trend follower.** The baseline signal above: 200-day SMA filter plus positive 126-trading-day momentum excluding the latest 21 days. Hold 15 names under the slot rules in section 4. Live qualifiers take slots first, strongest momentum first. A held name that still qualifies stays. A held name that no longer qualifies is sold only after it has also failed on the prior completed session and a new unheld qualifier with stronger 12-to-1 momentum needs that slot, oldest weaker hold first. A one-session fail stays. A weaker new qualifier waits. Remaining slots come from the fallback list. The book trades on the next session when a slot changes, and does not trade the slots that stay.
2. **Buy the dip.** The rules in the next section. Hold 10 names.
3. **Control.** The equal-weight hold of the basket. Buy all 34 names and leave them there. This is the Control account (`APCA_API_KEY_ID_CONTROL` and `APCA_API_SECRET_KEY_CONTROL`). On the start session, split the same $5,000 evenly across every name and do not trade again. Do not apply the trend filter, the dip rules, the slot limits, or the fallback list. Weights may drift as prices move. A name with no bar on the start session stays in cash, and the report lists it. Each opening buy is a notional order for the exact dollar amount, so the fill may be a fraction of a share. Alpaca paper accounts allow fractional shares by default, and the minimum buy notional is $1. A symbol that is not fractionable is skipped and listed. The cron submits those opening buys on the start session only.

The backtest scores those same three on the same start date, the same end date, and the same $5,000, and adds one series that is not a paper account:

4. **VUAA.** Buy and hold VUAA over that same span. VUAA is the London-listed USD share class of the Vanguard S&P 500 UCITS ETF (ticker VUAA, ISIN IE00BFMXXD54), which listed on 16 May 2019. It is accumulating, so dividends stay inside the price and the expense ratio is already in the series. It is not the official S&P 500 total-return index, and it is not the GBP listing VUAG. Score this holding on the aligned dates only. US bars from before the first VUAA bar may warm up the 200-day average, and those earlier sessions stay out of the comparison. Alpaca SIP bars do not include this listing, so it stays in the backtest cache and out of the paper accounts.

### Buy the dip

The second paper account, and the second active book in the backtest. It uses the same universe, next-session execution, costs, and portfolio rules as the trend follower. It buys a stock that is still in an uptrend and has pulled back, then holds it. It sells when the uptrend fails, or when the pullback has repaired and a stronger new dip needs that slot.

Evaluate once per trading day on completed daily bars. Reuse the baseline 200-day SMA and the 126-trading-day return excluding the most recent 21 trading days. Also calculate a 20-trading-day SMA.

Buy when all of the following are true:

- the latest completed close is above the 200-day SMA;
- the 12-to-1-month momentum return is positive;
- the latest completed close is below the 20-day SMA;
- that dip setup was also true on the prior completed session;
- the symbol is eligible for a new entry.

Sell an open dip position only when one of these is true:

1. **Trend broken:** the completed close is below the 200-day SMA. Sell on the next session even if no new dip is waiting.
2. **Recovered, and a stronger new dip needs the slot:** the completed close is back above the 20-day SMA, and an unheld name has a live dip buy that was already a dip on the prior session whose 12-to-1 momentum is strictly stronger. Do not sell a recovered name when no new dip is waiting, or when the new dip is weaker, or when the new name has been a dip for only one session. Do not sell an unrepaired dip to make room for another dip.

There is no session-count time stop. An unrepaired dip whose close is still at or below the 20-day SMA, and still above the 200-day SMA, stays. Persist the entry session per symbol so holding sessions can be reported. When several recovered holdings could yield, sell the oldest weaker recovered name. Execution of every exit is the next regular session. A recovered sale already requires a fresh close below the 20-day SMA before the next buy. A trend-break exit also requires a new dip before the next buy.

Signals use only data available at the decision timestamp. The earliest eligible order execution is the next regular trading session. These periods are initial hypotheses, not optimized parameters. Require sufficient warm-up history before producing signals.

The dip book holds 10 names under the slot rules in section 4. An open dip is a live signal and outranks every fallback. A recovered held dip keeps its slot until a stronger new dip needs it. A new unrepaired dip that does not fit waits unless a recovered holding, or a fallback, can yield. When several new dips are waiting, the weakest that day waits even if a slot is free. A trend-break exit frees one slot. That slot is filled by the strongest waiting entry, or by the next fallback when no entry is waiting. A name sold in that same rebalance is also skipped if the slot would otherwise buy it straight back as a fallback.

## 4. Portfolio construction and risk controls

Trend and dip each keep a fixed set of slots filled. Trend has 15 slots. Dip has 10. One slot is one name. The book stays invested. Cash is limited to rounding, to a slot that has no eligible name, and to the gap between a sell and the buy it funds. There is no 5% weight cap and no rule that parks the rest of the account in cash when few names signal.

Control is the third paper account. On the start session it spends the full equity in equal dollars on all 34 names, about $147 on a $5,000 start, and it does not trade again. The backtest includes that same holding, plus VUAA.

### Fallback list

Both strategies share one hardcoded fallback list. It is the 15 most traded names in the basket, most traded first. Rank is the median of daily dollar volume, `close × volume`, on Alpaca SIP daily bars with `adjustment=all`, over the 252 trading sessions ending 9 October 2026. A name with fewer sessions in that window is ranked on the sessions it has. SPCX has 83. The list does not refresh when the volume ranks change. Changing it changes the strategy.

1. NVDA
2. SNDK
3. AAPL
4. SPCX
5. AMZN
6. GOOGL
7. PLTR
8. NFLX
9. HOOD
10. BRK.B
11. IBM
12. DELL
13. UBER
14. ADBE
15. PFE

A fallback may be a name the signal rules would reject, including one below its 200-day average. The list itself never creates an order. A fallback is bought only to fill an open slot, and sold only to make room for a live signal.

### Slot rules

Evaluate the target book once per decision, after that day's signals. The paper job rebuilds that session's signals and the previous session's signals from the same bars, so a Trend name that has failed for two sessions can yield in paper the same way it does in the backtest. Persist for every held name: whether the slot is a signal or a fallback, the entry session, and, for a fallback, its rank on the list above.

Who may occupy a slot, in order:

1. Live signals, strongest 12-to-1 momentum first. For trend, a live signal is a name that qualifies, including a held name that still qualifies, and including a held name that no longer qualifies until it has failed for two sessions and a stronger new qualifier takes its slot. For dip, a live signal is an open dip that has been a dip for two sessions, including a name whose buy signal has fired and enters on the next session, including a held fallback that is a dip today and was already a dip on the prior session, and including a recovered dip that is still held. Extra live Trend qualifiers wait. They do not push out a name that still qualifies. A new trend may push out a held name that no longer qualifies only after a second failed session and only when that new name's 12-to-1 momentum is strictly stronger, oldest weaker hold first. A one-session fail stays. A weaker new trend waits. A new dip may push out a recovered held dip, oldest weaker recovered first, but not an unrepaired dip. A one-session dip waits, including a held fallback that is a dip only today. When several new dips are waiting, the weakest that day does not take a slot.
2. Fallback names, in the list order above, skipping a name that is already held.

A held fallback that becomes a live signal stays. It changes from a fallback slot to a signal slot, and that change is not a trade. For Dip, that promotion requires the name to have been a dip on the prior session. A one-session dip on a held fallback stays a fallback, so a stronger two-session dip can still take that slot.

The opening uses the prior close. Trend buys 15 names and Dip buys 10, signals first and then fallbacks, at that fill. Each of those buys is equal dollars: equity divided by the slot count. Control buys all 34 on that same session. In the backtest, that session is the comparison start. In paper trading, that session is the start session, Tuesday 13 October 2026, and the prior close is Monday 12 October 2026. The opening run places those buys on each account that has no positions and no open or filled opening orders. Every later run reads Control and submits no Control order.

After the start session, a change moves only the slots that enter and leave. Sell the name that leaves and buy the name that enters with those proceeds. Both orders are for the next session. Do not resize the other slots, and do not add to a name that is already held.

When a new signal needs a slot and a fallback is held, sell the fallback that has been held the longest. If several fallbacks share that entry session, sell the one later in the fallback list. When several slots change on the same day, pair each buy with one sale: the strongest incoming signal with the longest-held fallback sold, then the next. A slot freed by a signal exit, with no signal waiting, is filled by the highest-ranked fallback that is not already held.

A name sold in that rebalance is not eligible to be bought in that same rebalance. If no eligible name remains, that slot stays in cash until the next decision, and the report lists it.

A trend name is sold only after it has failed for two sessions and a new trend with stronger 12-to-1 momentum needs the slot, oldest weaker hold first. A name that still qualifies is not sold to make room. A one-session fail stays. A weaker new trend waits. A dip name is sold on a broken 200-day trend, or when a recovered name yields to a stronger new dip that was already a dip on the prior session. An unrepaired dip is not sold on a clock. A one-session dip does not take a new slot, including by promoting a held fallback. When several new dips are waiting, the weakest that day does not take a slot. The other slots stay put.

Skip a name with no bar on the execution session and take the next eligible name. On the start session, do not leave a hole and do not rescale the other buys; fill the slot from the next name. Buys are notional, so a fill may be a fraction of a share. Alpaca paper accounts allow that by default. A symbol that is not fractionable is skipped and listed.

Use current holdings, cash, and open orders when calculating order quantities. Skip an order below the configurable minimum notional and record the skip. Total exposure may not exceed 100% of portfolio equity. No leverage.

Long-only. The slot rules do not sell short and do not size a name above the dollars of the slot that funds it.

### Drawdown

Drawdown can be 100% of portfolio equity. Record portfolio equity and peak-to-trough drawdown daily.

- Fail closed: if prices are stale, account state is unavailable, an order has uncertain status, or risk calculations fail, do not submit new orders.

## 5. Backtesting and validation

The backtest must avoid look-ahead bias and unrealistic fills. Survivorship bias remains, because the universe is a fixed list of today's names.

### Backtest script

`scripts/backtest.js` is the research executable, separate from the deployed paper job. Run it locally with `node scripts/backtest.js` once the bar cache exists. It loads that cache, simulates Trend, Dip, Control, and VUAA through the shared modules, and writes `reports/backtest.md`. Refreshing the cache is a separate step that calls the historical bars endpoint and saves the file. A normal backtest run does not call Alpaca.

The report puts those four equity curves side by side over the same span, plus gross and net results, the pessimistic cost case, the out-of-sample window, and the limitations in this section. All four use the same first session, the same last session, and the same $5,000. Run this script first. Keep building and running the three Alpaca paper accounts whether or not the report is finished and whether or not either active strategy looks good in it.

### Execution assumptions

- Use Alpaca daily bars with `adjustment=all` for return calculations. That adjustment covers splits, cash dividends, and spin-offs. Do not mix `raw` and `all` in one backtest.
- Generate signals from completed daily bars only.
- Simulate execution no earlier than the next trading session, using a documented fill model.
- Charge a flat spread and slippage assumption per simulated fill. Run one sensitivity case with a more pessimistic assumption. Do not download historical quotes for the backtest. Quotes are raw and too large for this research. The paper job still logs that session's SIP opening quote, as in section 8.
- Open the VUAA holding at the comparison start with the same $5,000, charge the flat spread and slippage once on that buy, and hold it to the comparison end. Carry the last VUAA close across a London holiday and the last US close across a US holiday. Report how many sessions were carried. Do not invent a return on a day with no bar.
- Open Control on the comparison start. Charge the flat spread and slippage once on each initial buy, then hold to the comparison end. A missing bar for one name does not move the comparison start. Leave that name's share of the $5,000 in cash and list the name in the report.
- Open the trend book and the dip book on that same session, from the prior close, under the slot rules in section 4. Trend buys 15 names and dip buys 10. Charge the flat spread and slippage once on each of those buys. A name with no bar on the execution session is skipped, and the next eligible name fills that slot.
- VUAA is accumulating and priced in USD, so do not add a dividend adjustment or a currency conversion on top of its closes. Note any fee that the flat assumption does not include. The script refuses to write the comparison if the VUAA cache is missing.
- Do not treat Alpaca paper fills as proof of real-world execution quality.

### Data splits

- History on the free plan starts in 2016. The paper-aligned comparison itself starts on the first date that has a VUAA bar and a warmed-up signal, which cannot be earlier than 16 May 2019. Report that start, the last common bar, and the first and last US bars actually returned. Do not describe that sample as 15–20 years, and do not compare a strategy curve that begins in 2016 with a VUAA curve that begins in 2019.
- The long Yahoo sample is a separate comparison. It starts on the first date that has a VFINX bar and a warmed-up signal, which cannot be earlier than 3 January 2006. Report crash and bull windows (GFC peak to trough, COVID peak to trough, and the bulls around them) and NBER recession dates. Do not mix Yahoo bars into the Alpaca sample. Do not call VFINX VUAA.
- Use chronological development and validation periods inside that window.
- Reserve the latest 3–5 years as a final untouched out-of-sample period. The remaining development window is short; say so in the report.
- Use rolling/walk-forward evaluation across the available years.
- Do not adjust strategy rules in response to final test results and then continue to call the same period out-of-sample. If a slot rule is chosen after scoring this history, the report must say so and must not call that reserved window an untouched out-of-sample test of that rule.
- Report which dates, symbols, and Alpaca request parameters were actually used, and the source and bar count of the VUAA cache. Do not imply the paper-aligned sample tested history before 2016, or that VUAA was requested from `feed=sip`. When the long Yahoo sample is present, report its source, VFINX bar count, names missing at the comparison start, and ticker-mapping caveats.

### Metrics

Report at minimum:

- CAGR / annualized return.
- Maximum drawdown and drawdown duration.
- Annualized volatility.
- Sharpe ratio, with its calculation assumptions.
- Turnover and number of orders/trades.
- Win rate and average win/loss as secondary metrics only.
- Gross versus net performance.
- Performance of each series against the other three.
- Selection edge: whether the book beat Control after costs in the out-of-sample window.
- Market edge: whether the book beat VUAA after costs in the out-of-sample window.
- Results by market regime and calendar year.
- Sensitivity to the cost assumption.
- Number of observations and limitations of the sample.

A selection edge or a market edge is not accepted from a single period. Prefer stable out-of-sample results.

## 6. Daily production workflow

1. Vercel Cron sends `GET /api/cron` on weekdays at 22:00 UTC.
2. Accept the request only when `Authorization` matches `Bearer <CRON_SECRET>`. Never log secrets or commit them.
3. Acquire a database-backed lock for the strategy and trading date.
4. Trade the latest completed US cash session. After 16:15 New York on a trading day, that is today. On a weekend, a holiday, or before the open, that is the previous regular session. Wait out an open cash session until 16:15 so today's in-progress bar is not used and new market/day orders are not sent while the session can still fill them immediately. Then verify that the latest daily bars for that session are complete and sufficiently fresh. Account for US holidays and daylight-saving-time changes. A missed Friday job can be rerun on Saturday against Friday's bars.
5. Fetch that session's daily bars from the same historical endpoint (`feed=sip`, `adjustment=all`) and validate them. 22:00 UTC is hours after the 15-minute SIP delay, so the free plan can return the completed session.
6. Fetch each paper account with its own key pair. Trend uses `APCA_API_KEY_ID_TREND` and `APCA_API_SECRET_KEY_TREND`. Dip uses `APCA_API_KEY_ID_DIP` and `APCA_API_SECRET_KEY_DIP`. Control uses `APCA_API_KEY_ID_CONTROL` and `APCA_API_SECRET_KEY_CONTROL`. For each account, read equity, cash, positions, and open orders. The shared daily bars and the opening quote use one of those paper pairs against `data.alpaca.markets`. A trend order never uses the dip or control keys, and the same rule applies to the other two books. If any of the six variables is missing, fail the run before any order is sent.
7. Calculate signals and target weights in the independent strategy module. Trend and dip produce a target book every session. Control's only target is the start-session equal-dollar buy of all 34 names. After that buy, the target is the positions already held.
8. Run risk checks and reconcile target positions with holdings/open orders.
9. Create durable order intents with deterministic identifiers before submitting orders. Each intent names the account it belongs to and includes the plain-language reason from the rule that created it, as in section 8. Control intents are created only on the start session.
10. Submit orders to Alpaca Paper Trading only. Send each intent to its own account with that account's key pair. On the start session, Control buys every basket name that has a bar, in equal dollars, then holds. On every later session the cron still loads the control account and records equity and positions, and it submits no control order. Trend and dip still trade when a slot changes. Do not rebalance the control book when weights drift.
11. Reconcile order status and fills. Do not assume a successful HTTP response means an order filled.
12. Persist the run, data timestamps, signals, targets, order intents, the reason for each buy and sell, broker order IDs, statuses, errors, that session's opening quotes, and fill-level spread costs.
13. Send an alert on failure, stale data, unexpected position, or uncertain order status. An unexpected position is a broker lot with no `book_state` row. If that lot matches this book's own buy intent, adopt the intent's slot metadata and continue. If it does not, fail closed: alert with every unexpected symbol, submit no new order, and do not sell the lot. A same-day rerun must not stamp `already_present` onto an opening intent in a way that drops it from reconciliation, and must not send the opening buys again while those orders are still open. After every run, including skips, email a natural-language summary of what was done and why to the operator. A missing mail key skips the email and does not fail the run.
14. Release the lock only after the run reaches a known terminal state.

Vercel Cron can invoke a job more than once, and failed invocations should not be assumed to retry automatically. The handler must therefore be idempotent and support a safe rerun of the same job. A rerun is the job again. It is not a person placing an order.

### Scheduling

- Schedule `0 22 * * 1-5` in `vercel.json`. Cron expressions are UTC, and day-of-month stays `*` when day-of-week is set.
- 22:00 UTC is 17:00 America/New_York in winter and 18:00 in summer, so the whole hour is after the 16:00 cash close in both.
- On Hobby, a cron runs at most once per day and may fire any time during that hour (22:00–22:59 UTC). On Pro it fires at the scheduled minute. Expressions that run more than once per day fail deployment on Hobby.
- Treat the cron trigger as a wake-up signal, not proof that market data is finalized. If the latest completed session's bars are not ready, record a skipped run and avoid trading. A weekend or holiday wake-up still runs: it uses that earlier completed session so a missed weekday job can be corrected by hand. A mid-session wake-up still waits until 16:15.

## 7. Alpaca integration and environment safety

- Start with Alpaca Paper Trading only.
- Keep paper and live credentials completely separate.
- Configure an explicit environment mode, defaulting to paper; fail startup if live mode is requested without an explicit deployment-level approval.
- Use the paper trading base URL and paper API keys in the initial deployment.
- Never put API key values in source control, logs, or test fixtures. Store the six variables below as Vercel project environment variables. For local runs, read them from `.env` or `.env.local`. Both files stay uncommitted.
- The cron trades with these pairs, and only these pairs:
  - Trend follower: `APCA_API_KEY_ID_TREND`, `APCA_API_SECRET_KEY_TREND`
  - Buy the dip: `APCA_API_KEY_ID_DIP`, `APCA_API_SECRET_KEY_DIP`
  - Control, the equal-weight hold: `APCA_API_KEY_ID_CONTROL`, `APCA_API_SECRET_KEY_CONTROL`
- `api/cron.js` is the only order sender. Each order uses the key pair of the account it belongs to.
- The Control account places orders on the start session only. That run buys all 34 names in equal dollars and then holds. Later weekday runs load the account for reconciliation and submit no order for it.
- Use deterministic `client_order_id` values and persist order intents before submitting.
- Before retrying an order submission after a timeout, query Alpaca for the existing order using its client identifier; do not blindly submit a duplicate.
- Reconcile open orders and actual positions on every run.
- Verify account eligibility, supported symbols, order types, fractional-share rules, data-feed entitlement, rate limits, and funding/withdrawal costs before any future live deployment.
- Paper trading approximates order workflows but does not perfectly model spreads, market impact, queue position, all fees, or live fills.

## 8. Spread logging

The spread is not an Alpaca fee. For paper fills, compare the three paper accounts by the dollars they give up between the bid and the ask. Store that cost in Supabase so each account is charged from the same quotes. The backtest does not replay quotes. It uses the flat spread and slippage assumption in section 5.

The free Alpaca data plan can supply this. Live quotes on that plan are IEX-only. Historical full-market quotes are available through `feed=sip` once they are at least 15 minutes old. The daily job runs after the US close, so that session's opening quote qualifies. Do not use IEX quotes for this log. If the SIP quote for a symbol is missing, record the gap and leave the spread cost empty. Do not substitute a later quote.

Record the earliest SIP quote at or after 09:30 America/New_York, and only if it falls inside the first minute of the regular session. `session_date` is that New York trading date, not the UTC date.

One opening quote is shared by every strategy. A strategy pays spread only on its own fills, using that shared quote:

- Buy cost = shares × (fill price − midpoint)
- Sell cost = shares × (midpoint − fill price)
- Midpoint = (bid + ask) / 2

This formula applies to paper fills only. Paper equity does not report this cost on its own.

### Access

`api/cron.js` is the only writer. It calls the Data API with `SUPABASE_URL` and `SUPABASE_SECRET_KEY`. The secret key bypasses row-level security, so it stays in Vercel environment variables and is read only inside the function.

Enable row-level security on every table below and add no policies for `anon` or `authenticated`. A publishable key then cannot read or write them. Revoke table privileges from those roles as well.

Upsert quotes on `(session_date, symbol)`, fill costs on `client_order_id`, and order reasons on `client_order_id`, so a repeated cron run does not double-count.

### Schema

```sql
create table public.strategies (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.opening_quotes (
  id bigint generated always as identity primary key,
  session_date date not null,
  symbol text not null,
  quote_at timestamptz not null,
  bid numeric(18, 6) not null,
  ask numeric(18, 6) not null,
  bid_size numeric(18, 4),
  ask_size numeric(18, 4),
  feed text not null default 'sip' check (feed = 'sip'),
  midpoint numeric(18, 6) generated always as ((bid + ask) / 2) stored,
  spread numeric(18, 6) generated always as (ask - bid) stored,
  recorded_at timestamptz not null default now(),
  unique (session_date, symbol),
  constraint opening_quotes_prices check (bid > 0 and ask >= bid),
  constraint opening_quotes_symbol check (symbol = upper(symbol))
);

create table public.fill_spread_costs (
  id bigint generated always as identity primary key,
  strategy_id uuid not null references public.strategies (id),
  opening_quote_id bigint not null references public.opening_quotes (id),
  session_date date not null,
  symbol text not null,
  side text not null check (side in ('buy', 'sell')),
  client_order_id text not null unique,
  shares numeric(18, 6) not null check (shares > 0),
  fill_price numeric(18, 6) not null check (fill_price > 0),
  fill_at timestamptz not null,
  spread_cost_usd numeric(18, 6) not null,
  recorded_at timestamptz not null default now()
);

create index fill_spread_costs_strategy_session_idx
  on public.fill_spread_costs (strategy_id, session_date);

create table public.order_reasons (
  id bigint generated always as identity primary key,
  strategy_id uuid not null references public.strategies (id),
  session_date date not null,
  symbol text not null,
  side text not null check (side in ('buy', 'sell')),
  client_order_id text not null unique,
  reason text not null check (char_length(btrim(reason)) > 0),
  recorded_at timestamptz not null default now(),
  constraint order_reasons_symbol check (symbol = upper(symbol))
);

create index order_reasons_strategy_session_idx
  on public.order_reasons (strategy_id, session_date);

alter table public.strategies enable row level security;
alter table public.opening_quotes enable row level security;
alter table public.fill_spread_costs enable row level security;
alter table public.order_reasons enable row level security;

revoke all on public.strategies from anon, authenticated;
revoke all on public.opening_quotes from anon, authenticated;
revoke all on public.fill_spread_costs from anon, authenticated;
revoke all on public.order_reasons from anon, authenticated;
```

`spread_cost_usd` is written by the server from the formula above. A test should reject a row whose stored cost does not match that formula for its side, shares, fill price, and quoted midpoint.

Compare the three paper accounts by summing `spread_cost_usd` per `strategy_id`, and by dividing that sum by the dollars traded (`shares * fill_price`).

### Order reasons

The paper job writes one row in `order_reasons` for every buy and every sell, in the same step that creates the order intent and before the order is sent to Alpaca. `session_date` is the New York date of the session the order is meant to trade, the same date as the opening quote. `client_order_id` is the intent's identifier. A fill in `fill_spread_costs` uses that same identifier. A reason can exist without a fill when the broker rejects or never fills the order. A strategy fill with no matching reason is an audit failure.

`reason` is one or two sentences written by the strategy module from the rule that created the order and the values that made the rule true. The same inputs produce the same text, so a rerun upserts the same sentence. The sentence names the symbol, the side, the rule, and those values: the close, the moving average it was compared with, the sign of 12-to-1 momentum, the fallback rank, the holding-session count, and the other name when one order funds or replaces another.

The sentence covers the case that actually fired:

- A trend buy names the 200-day SMA comparison, the positive momentum result, and the name's place in the momentum ranking that gave it the slot.
- A dip buy names the 200-day SMA comparison, the positive momentum result, the close below the 20-day SMA, and that the name was already a dip on the prior session.
- A fallback buy names the open slot, the absence of a waiting live signal, and this name's rank on the fallback list.
- A trend sell names the qualifier that failed, that the name had already failed on the prior session, that a new trend with stronger 12-to-1 momentum needs the slot, how many holding sessions had elapsed, and the incoming name when the sale funds a new trend.
- A dip sell names which exit fired: trend broken, or a recovered name yielding to a stronger new dip, and how many holding sessions had elapsed.
- A fallback sell that frees a slot names the entry session, the list rank used as the tie-break, and the incoming signal the sale funds.
- An opening buy says it is the start-session fill and whether the slot is a signal or a fallback.

An order that is skipped, including one below the minimum notional, is not a row in this table. The run record still notes the skip. The backtest script does not write this table.

## 9. Reliability, observability, and security

- Use structured logs with a run ID and trading date; redact secrets and sensitive account details.
- Store run status as explicit states (e.g. `started`, `skipped_data_not_ready`, `signals_calculated`, `orders_submitted`, `reconciled`, `failed`).
- Make state transitions durable and recoverable.
- Prevent concurrent runs for the same strategy/date with a database lock or unique constraint.
- Add timeouts and bounded retries only for safe, idempotent reads.
- Do not automatically retry uncertain order submissions without reconciliation.
- Alert on failed runs, stale prices, data gaps, unexpected broker positions, and failed reconciliation. Adopt an unexpected lot that matches this book's own buy intent. A lot with no matching buy fails the run and is not sold.
- Add a dry-run mode that calculates and logs intended orders without submitting them.
- Add a manual kill switch that blocks new orders.
- Include unit tests for market calendar handling, stale-data checks, signal calculations, target allocation, order rounding, duplicate runs, and uncertain order submission.
- Test that each buy and sell stores a reason naming the rule that created it and the values that rule used, and that a second run with the same inputs stores the same text.

## 10. Milestones

Run `node scripts/backtest.js` as soon as the cache and the three books exist, and read `reports/backtest.md` first. Build the three Alpaca paper accounts on their own track at the same time. A missing report or a weak result does not delay paper orders.

### Milestone 1 — Data and research baseline

- Fetch and cache free-plan SIP daily bars (`feed=sip`, `adjustment=all`) for the fixed basket.
- Cache daily bars for VUAA (London, USD, accumulating) in a separate versioned file. Record the source. Do not request it from `feed=sip`.
- Cache a separate Yahoo Finance long sample for the same basket plus VFINX, from 2005. Do not mix it with the SIP cache.
- Validate bar timestamps, missing sessions, and the adjustment choice.
- Produce a simple buy-and-hold VUAA result over the dates that series actually covers.
- Document that history starts in 2016, that the basket is today's names, and that the backtest is survivorship-biased.

### Milestone 2 — Backtest script

- Implement Trend, Dip, and Control in the shared modules, and score them with VUAA.
- Implement execution costs and portfolio accounting.
- `node scripts/backtest.js` writes `reports/backtest.md` from the cached bars.
- Add tests against look-ahead bias and other common backtest errors.

### Milestone 3 — Robustness review

- Run chronological out-of-sample and walk-forward tests.
- Evaluate transaction-cost sensitivity. The trend and dip rules stay as specified.
- If a test shows the shared signal code is using future data, fix that module before either the script or the paper job relies on it. Unmodeled costs belong in the report as a stated limitation.

### Milestone 4 — Paper-trading integration

- Implement Alpaca paper adapter.
- Add order intent persistence, idempotency, reconciliation, alerts, and manual kill switch.
- Persist that session's SIP opening quotes, per-fill spread costs, and a plain-language reason for every buy and sell through the Supabase Data API.
- Verify behavior during holidays, missing data, duplicate invocations, API errors, and partial fills.

### Milestone 5 — Paper-trading observation

- Run for at least 3–6 months as an initial operational test.
- Compare live paper signals, intended orders, fills, and costs with backtest expectations.
- Treat this duration as an operational smoke test, not sufficient evidence of long-term profitability.
- Review failures and unexpected behavior before considering any live trading.

### Milestone 6 — Live-readiness review (out of initial scope)

Do not enable live orders until eligibility, tax implications, funding and withdrawal costs, market-data licensing, order behavior, security, and operational recovery have been reviewed. Require explicit human approval before any live deployment.

## 11. Definition of done

The initial project is complete when:

- Running `node scripts/backtest.js` reproduces `reports/backtest.md` from documented configuration, the shared Node.js modules, and the versioned cache of Alpaca daily bars.
- The three paper accounts, and the four backtest series, use the same documented execution and cost assumptions.
- The report includes benchmarks, out-of-sample results, drawdown, turnover, costs, and limitations.
- Unit and integration tests cover the major risk paths.
- Vercel Cron can trigger a paper run safely, including duplicate invocations and recoverable failures.
- The system never submits live orders in the initial deployment.
- Every run and order can be audited from persisted records.
- Every paper buy and sell has an `order_reasons` row, written before submission, whose `reason` states the rule and the values that fired it and whose `client_order_id` matches the order intent and any fill.
- Spread cost for each paper fill is stored in Supabase and can be totaled per strategy from the shared opening quotes.
- The README explains setup, environment variables, data assumptions, how to run `node scripts/backtest.js`, how to run paper trading, and known limitations.

## Non-goals for the first version

- Machine-learning or LLM-based price prediction.
- Intraday/high-frequency trading.
- Leverage, margin, options, CFDs, or short selling.
- Unsupervised parameter optimization across large search spaces.
- Automatic live trading.
- Claiming that the system can guarantee future profitability.
