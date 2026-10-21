# Basket books

A long-only comparison of two rule-based books and a hold of the same basket, scored in a backtest that also holds VUAA.

## Language

**Basket**:
The fixed list of 34 symbols a book may hold.
_Avoid_: universe, index

**Book**:
A long-only holding under test. There are three: Trend, Dip, and Control.
_Avoid_: strategy, portfolio

**Trend**:
The book that follows the trend rules.
_Avoid_: trend follower

**Dip**:
The book that buys a pullback while an uptrend holds.
_Avoid_: buy the dip

**Control**:
The book that holds the basket in equal weights from the start session and is not traded again.
_Avoid_: equal distribution hold, equal-weight hold

**Account**:
The paper-trading account that holds one book. Its positions change only when that book's rules trade.
_Avoid_: strategy account

**Series**:
One equity curve in the backtest. Each book has a series. VUAA is a series and has no book.
_Avoid_: benchmark

**VUAA**:
The backtest-only buy-and-hold of the Vanguard S&P 500 UCITS ETF, USD accumulating share class, used on the paper-aligned sample.
_Avoid_: the market, SPY

**VFINX**:
The backtest-only buy-and-hold of the Vanguard 500 Index Investor fund, used on the long Yahoo sample because VUAA listed in 2019.
_Avoid_: the market, SPY, VUAA

**Long sample**:
The Yahoo Finance research window that starts in 2006. It is not the paper comparison.
_Avoid_: 20-year proof, full history

**Selection edge**:
A book beating Control after costs, out of sample.
_Avoid_: edge

**Market edge**:
A book beating VUAA after costs, out of sample.
_Avoid_: edge

**Start session**:
The US regular session on which the three paper books open together.
_Avoid_: day 0

**Comparison start**:
The first backtest session that has a VUAA bar and a warmed-up signal. It is not the start session.
_Avoid_: start date
