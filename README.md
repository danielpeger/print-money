# Basket books

Trend, Dip, and Control run as three long-only paper books on one fixed basket of 34 symbols. A backtest scores those three plus a buy-and-hold of VUAA. VUAA is not a paper account.

A selection edge means a book beat Control after costs, out of sample. A market edge means a book beat VUAA after costs, out of sample. The report states each one for a single window. One window is not enough to accept either. The paper accounts run either way.

## Setup

Node.js 22.

```bash
npm install
```

Copy `.env.example` to `.env`. Do not commit it. The paper job reads:

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | Data API. Only `api/cron.js` writes. Use the secret key. |
| `APCA_API_KEY_ID_TREND`, `APCA_API_SECRET_KEY_TREND` | Trend paper account |
| `APCA_API_KEY_ID_DIP`, `APCA_API_SECRET_KEY_DIP` | Dip paper account |
| `APCA_API_KEY_ID_CONTROL`, `APCA_API_SECRET_KEY_CONTROL` | Control paper account |
| `APCA_API_BASE_URL` | `https://paper-api.alpaca.markets/v2` |
| `ALPACA_PAPER` | `true`. Any other host is refused. |
| `CRON_SECRET` | `Authorization: Bearer <CRON_SECRET>` on `GET /api/cron` |
| `KILL_SWITCH` | `true` blocks new orders and does not sell a book |
| `DRY_RUN` | `true` calculates orders and does not submit them |
| `ALERT_WEBHOOK_URL` | Optional POST target when a run fails |
| `RESEND_KEY` | Sends a natural-language summary to `pegerdaniel@gmail.com` after every run, including skips. Uses Resend. Optional `RESEND_FROM` if a domain is verified; otherwise `onboarding@resend.dev`. Put the same key on the Vercel project so cron mails too. |

Apply `supabase/migrations/20261012233000_initial_schema.sql` to the Supabase project. Row level security is on and there are no policies for `anon` or `authenticated`.

The same migration is what the daily job expects: book rows for `trend`, `dip`, and `control`, plus a kill-switch row.

## Data

US bars for the paper-aligned sample come from Alpaca only:

`GET https://data.alpaca.markets/v2/stocks/bars?timeframe=1Day&feed=sip&adjustment=all`

The free plan starts in 2016. The latest 15 minutes of SIP are withheld, so the fetch ends 20 minutes before the request. `adjustment=all` includes splits, cash dividends, and spin-offs. Raw and adjusted bars are not mixed.

VUAA is the Vanguard S&P 500 UCITS ETF, USD accumulating share class, ISIN IE00BFMXXD54, Yahoo symbol `VUAA.L`. It is not requested from `feed=sip`. It is not VUAG and not SPY. Its cache is `data/bars/vuaa.json`.

A second, labeled research sample uses Yahoo Finance daily bars for the same 34 names plus VFINX, the Vanguard 500 Index Investor fund, from 2005. That sample can score 2008 and COVID. It is not mixed with Alpaca SIP bars, it does not feed paper trading, and VFINX is not VUAA.

```bash
npm run fetch-bars
npm run fetch-vuaa
npm run fetch-yahoo
```

The basket is today's names, held for the whole history. That is survivorship bias. A name that disappears is a gap. The paper-aligned sample does not fill gaps from Yahoo. The Yahoo sample is a separate cache.

## Backtest

```bash
npm test
npm run backtest
```

`node scripts/backtest.js` reads the caches, runs Trend, Dip, Control, and VUAA through the same modules the paper job uses, and writes `reports/backtest.md` plus `reports/equity.csv`. If the Yahoo caches exist, it also scores the long sample against VFINX and appends that chapter, plus `reports/equity-long.csv`. It does not call Alpaca. It refuses to write the paper comparison if the VUAA cache is missing or marked `feed=sip`.

Signals use the completed close. The fill is the next regular session's open. The base cost is 5 bps of notional per fill, taken out of the buy and out of the sale proceeds. The pessimistic case is 20 bps. The paper comparison starts on the first US session on or after 16 May 2019 that has a VUAA bar and a warmed-up signal, and it ends on the last session the two Alpaca/VUAA caches share. The long Yahoo comparison starts on the first US session on or after 3 January 2006 that has a VFINX bar and a warmed-up signal. The latest four years are reported as a reserved window in both samples. SMA and momentum lengths were not refit. Slot rules were chosen after scoring this history: Trend yields only after a second failed session and a stronger incoming name, Dip has no time stop, a new Dip must have been a dip on the prior session including a held fallback, a recovered Dip yields only to a stronger new dip, and the weakest new Dip that day does not take a slot.

## Paper trading

The start session is Tuesday 13 October 2026. The opening run is after the US close on Monday 12 October 2026. It reads that session's bars and submits opening orders for Tuesday.

```bash
npm run paper:dry
npm run paper
```

`api/cron.js` is the same job. `vercel.json` schedules `GET /api/cron` at `0 22 * * 1-5` UTC, which is after the 16:00 New York cash close in both winter and summer. The request is rejected unless `Authorization` is `Bearer <CRON_SECRET>`. Vercel Cron runs on the production deployment.

Each run:

1. Uses the latest completed US cash session. After 16:15 America/New_York on a trading day, that is today's close. On a weekend, a holiday, or before the cash open, that is the previous regular session. A Saturday rerun of a missed Friday job therefore reads Friday and submits for Monday. It still skips while the cash session is open, until 16:15, so an in-progress bar is not treated as final and a market order does not fill at the live quote. The scheduled cron still fires only on weekdays.
2. Takes a database lock for that session. A second invocation waits or exits. A rerun after the lock is released uses the same client order ids and does not send a duplicate.
3. Loads all three accounts with their own keys. A missing key, a stale bar, an unexpected position, or an uncertain order stops the run before any new order. The leverage check refuses only a buy that would increase long value beyond the current book or beyond equity. A leftover cash hole from a prior fill does not block a hold or a cash-neutral swap. A live buy is capped at broker cash plus estimated sale proceeds; a slice that no longer fits is skipped.
4. Writes a plain-language reason, then the order intent, then submits to the paper API. Control buys the basket in equal dollars on the opening run only. Later runs load Control and send no order.
5. Logs that session's SIP opening quote and, once a fill exists, the spread against the midpoint `(bid + ask) / 2`.
6. Emails a plain-language summary of what the run did and why, including order reasons, skips, adopted lots, booked fills, one-session signals that still wait, and extra names waiting for a slot. A missing `RESEND_KEY` skips the mail and does not fail the run.

An unexpected position is a name the broker holds that has no `book_state` row. The job first tries to adopt it from this book's own buy intent (slot kind, entry session, fallback rank). That recovers a fill that was never booked, including an opening buy whose intent was later stamped `already_present` by a same-day rerun. A name with no matching buy is a true orphan: the run alerts, records every unexpected symbol, and submits nothing. It does not sell the orphan. A second run of the same session with opening orders still at the broker does not send those buys again.

Set `KILL_SWITCH=true`, or `kill_switch` on the `controls` row, to block new orders. The book stays as it is.

This deployment never submits to a live Alpaca host.

## Rules

Trend holds 15 names. Dip holds 10. A Trend name that still qualifies keeps its slot. Extra Trend signals wait. They do not push out a name that still qualifies. A Trend name that no longer qualifies is sold only after it has also failed on the prior session and a new trend with stronger 12-to-1 momentum needs the slot, and the oldest weaker holding is the one sold. A one-session fail stays. A weaker new trend waits. Dip keeps an unrepaired dip. A new Dip must have been a dip on the prior session, including a held fallback that would otherwise promote. When several new dips are waiting, the weakest that day does not take a slot. A recovered Dip name is sold only when a two-session dip with stronger 12-to-1 momentum needs the slot. An open slot is filled from this fallback list, most traded first. The list does not refresh:

NVDA, SNDK, AAPL, SPCX, AMZN, GOOGL, PLTR, NFLX, HOOD, BRK.B, IBM, DELL, UBER, ADBE, PFE.

Trend buys when the close is above the 200-day average and the 126-trading-day return ending 21 days earlier is positive. A held Trend name is not sold just because that qualifier fails. It is sold after a second failed session when a new trend with stronger 12-to-1 momentum needs the slot. A weaker new trend waits. Dip also requires the close to be below the 20-day average, and that this was already true on the prior session. Dip sells when the close falls below the 200-day average, or when the close is back above the 20-day average and a stronger two-session dip needs the slot. An unrepaired dip is not sold on a clock.

Control buys every basket name that can take a fractional notional order, in equal dollars, and then holds. A name that is not fractionable, or that has no bar, stays in cash. The other buys are not resized.

Long only. No leverage. The book deploys at most $5,000 even if the paper account is larger.

## Limitations

The backtest is survivorship-biased. The paper-aligned sample starts in 2016, and that comparison starts in 2019. The Yahoo sample starts in 2006 so that 2008 and COVID are in the report; many of today's names did not exist then, and Control leaves those slices in cash. Yahoo may map a current ticker onto a predecessor. The cost is a flat assumption, not a measured spread. Paper fills are not evidence of live execution. The windows above were chosen up front and were not changed after seeing results. Nothing here is a forecast, and nothing here is a promise of profit.
