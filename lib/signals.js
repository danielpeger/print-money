/**
 * First matching dip exit. Holding sessions include the entry session.
 * A missing price is not an exit; the caller fails closed instead.
 * An unrepaired dip is not sold on a clock. It waits for a repair or a trend break.
 */
export function dipExit(signal) {
  if (!signal || signal.close == null || signal.sma200 == null || signal.sma20 == null) return null;
  if (signal.close < signal.sma200) return 'trend_broken';
  if (signal.close > signal.sma20) return 'dip_repaired';
  return null;
}
