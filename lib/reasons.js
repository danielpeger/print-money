import { formatNumber, formatPct } from './dates.js';

function price(value) {
  return formatNumber(value, 2);
}

function mom(value) {
  return formatPct(value, 1);
}

function slotSentence(slotKind) {
  if (slotKind === 'signal') return 'The slot is a signal.';
  if (slotKind === 'fallback') return 'The slot is a fallback.';
  return 'The slot is a control holding.';
}

export function reasonFor(order) {
  const symbol = order.symbol;
  const side = order.side === 'sell' ? 'Sell' : 'Buy';
  if (order.book === 'control' && order.side === 'buy') {
    return `Buy ${symbol} on the start session. Control buys the basket in equal dollars and does not trade again.`;
  }
  if (order.opening && order.side === 'buy') {
    const detail = order.slotKind === 'signal' ? signalBuyDetail(order) : fallbackBuyDetail(order);
    return `Buy ${symbol} on the start session. ${slotSentence(order.slotKind)} ${detail}`;
  }
  if (order.side === 'buy' && order.slotKind === 'signal' && order.book === 'dip') {
    return `${side} ${symbol}. It qualifies for Dip: the close ${price(order.close)} is above the 200-day SMA ${price(order.sma200)}, 12-to-1 momentum is positive at ${mom(order.momentum)}, the close is below the 20-day SMA ${price(order.sma20)}, and it was already a dip on the prior session.`;
  }
  if (order.side === 'buy' && order.slotKind === 'signal') {
    return `${side} ${symbol}. It qualifies for Trend: the close ${price(order.close)} is above the 200-day SMA ${price(order.sma200)}, and 12-to-1 momentum is positive at ${mom(order.momentum)}. That momentum ranks it ${order.rank} among live names.`;
  }
  if (order.side === 'buy' && order.slotKind === 'fallback') {
    return `${side} ${symbol} to fill an open slot. No live signal is waiting for that slot. ${symbol} ranks ${order.fallbackRank} on the fallback list.`;
  }
  if (order.side === 'sell' && order.slotKind === 'fallback') {
    const incoming = order.pairedSymbol
      ? `The sale funds the buy of ${order.pairedSymbol}.`
      : 'No buy was paired, so the slot stays in cash.';
    return `Sell ${symbol} to free a slot. It entered on ${order.entrySession} and ranks ${order.fallbackRank} on the fallback list, so a same-day tie sells it before an earlier rank. ${incoming}`;
  }
  if (order.side === 'sell' && order.book === 'dip') {
    return dipSell(order);
  }
  if (order.side === 'sell') {
    return trendSell(order);
  }
  return `${side} ${symbol}.`;
}

function signalBuyDetail(order) {
  if (order.book === 'dip') {
    return `The close ${price(order.close)} is above the 200-day SMA ${price(order.sma200)}, 12-to-1 momentum is positive at ${mom(order.momentum)}, the close is below the 20-day SMA ${price(order.sma20)}, and it was already a dip on the prior session.`;
  }
  return `The close ${price(order.close)} is above the 200-day SMA ${price(order.sma200)}, and 12-to-1 momentum is positive at ${mom(order.momentum)}. That momentum ranks it ${order.rank} among live names.`;
}

function fallbackBuyDetail(order) {
  return `No live signal is waiting for the remaining slots. ${order.symbol} ranks ${order.fallbackRank} on the fallback list.`;
}

function trendSell(order) {
  const parts = [];
  if (!(order.close > order.sma200)) {
    parts.push(`the close ${price(order.close)} is not above the 200-day SMA ${price(order.sma200)}`);
  }
  if (!(order.momentum > 0)) {
    parts.push(`12-to-1 momentum is not positive at ${mom(order.momentum)}`);
  }
  if (parts.length === 0) parts.push('a qualifier no longer holds');
  const incoming = order.pairedSymbol
    ? ` The sale funds the buy of ${order.pairedSymbol}.`
    : ' No buy was paired, so the slot stays in cash.';
  const held = order.holdingSessions;
  const age = held != null ? ` The position had been held for ${held} sessions, had already failed on the prior session, and was the oldest weaker Trend holding sold in this rebalance.` : '';
  return `Sell ${order.symbol}. It no longer qualifies for Trend: ${parts.join(', and ')}, and a new trend with stronger 12-to-1 momentum needs the slot.${incoming}${age}`;
}

function dipSell(order) {
  const held = order.holdingSessions;
  if (order.exitRule === 'trend_broken') {
    return `Sell ${order.symbol}. The dip exit is trend broken: the close ${price(order.close)} is below the 200-day SMA ${price(order.sma200)}. The position had been held for ${held} sessions.`;
  }
  const incoming = order.pairedSymbol
    ? ` The sale funds the buy of ${order.pairedSymbol}.`
    : ' No buy was paired, so the slot stays in cash.';
  if (!(order.close > order.sma20)) {
    return `Sell ${order.symbol}. The close ${price(order.close)} is not above the 20-day SMA ${price(order.sma20)}, and a new dip with stronger 12-to-1 momentum needs the slot.${incoming} The position had been held for ${held} sessions.`;
  }
  return `Sell ${order.symbol}. The close ${price(order.close)} is back above the 20-day SMA ${price(order.sma20)}, and a new dip with stronger 12-to-1 momentum needs the slot.${incoming} The position had been held for ${held} sessions and was the oldest weaker recovered holding sold in this rebalance.`;
}
