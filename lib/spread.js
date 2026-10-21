/** Paper-fill spread against the shared opening midpoint. Positive means the fill paid the spread. */
export function spreadCost({ side, shares, fillPrice, bid, ask }) {
  if (!(shares > 0) || !(fillPrice > 0) || !(bid > 0) || !(ask >= bid)) return null;
  const midpoint = (bid + ask) / 2;
  if (side === 'buy') return shares * (fillPrice - midpoint);
  if (side === 'sell') return shares * (midpoint - fillPrice);
  return null;
}

export function spreadCostMatches(row, quote) {
  const expected = spreadCost({
    side: row.side,
    shares: Number(row.shares),
    fillPrice: Number(row.fill_price ?? row.fillPrice),
    bid: Number(quote.bid),
    ask: Number(quote.ask),
  });
  if (expected == null) return false;
  const stored = Number(row.spread_cost_usd ?? row.spreadCostUsd);
  return Math.abs(stored - expected) < 1e-6;
}
