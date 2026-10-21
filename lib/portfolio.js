export function createBook(cash) {
  return {
    cash,
    positions: new Map(),
    cooldown: new Set(),
  };
}

export function markToMarket(book, priceOf) {
  let equity = book.cash;
  let carried = 0;
  for (const [symbol, position] of book.positions) {
    const quote = priceOf(symbol);
    if (!quote || !(quote.price > 0)) return { ok: false, symbol };
    if (quote.carried) carried += 1;
    equity += position.shares * quote.price;
  }
  return { ok: true, equity, carried };
}

/**
 * Sells first, then buys. A paired buy spends that sale's proceeds.
 * An opening buy spends its reserved notional and does not take a skipped name's dollars.
 */
export function applyFills({ book, sells, buys, openPrice, costRate, minNotional }) {
  const fills = [];
  const skipped = [];
  const trades = [];
  const proceedsByPair = new Map();

  for (const sell of sells) {
    const position = book.positions.get(sell.symbol);
    if (!position) {
      skipped.push({ symbol: sell.symbol, side: 'sell', reason: 'no_position' });
      continue;
    }
    const open = openPrice(sell.symbol);
    if (!(open > 0)) {
      skipped.push({ symbol: sell.symbol, side: 'sell', reason: 'no_open' });
      continue;
    }
    const gross = position.shares * open;
    const cost = gross * costRate;
    const net = gross - cost;
    book.cash += net;
    const pnl = net - position.cashOut;
    trades.push({
      symbol: sell.symbol,
      entrySession: position.entrySession,
      exitSession: sell.executionDate,
      pnl,
      cashOut: position.cashOut,
      proceeds: net,
    });
    fills.push({
      ...sell,
      shares: position.shares,
      price: open,
      notional: gross,
      cost,
    });
    if (sell.pairId) proceedsByPair.set(sell.pairId, net);
    book.positions.delete(sell.symbol);
  }

  for (const buy of buys) {
    const open = openPrice(buy.symbol);
    if (!(open > 0)) {
      skipped.push({ symbol: buy.symbol, side: 'buy', reason: 'no_open' });
      continue;
    }
    let budget = buy.pairId && proceedsByPair.has(buy.pairId) ? proceedsByPair.get(buy.pairId) : buy.notional;
    if (budget == null) budget = 0;
    budget = Math.min(budget, book.cash);
    if (!(budget >= minNotional)) {
      skipped.push({ symbol: buy.symbol, side: 'buy', reason: 'below_min_notional', notional: budget });
      continue;
    }
    const cost = budget * costRate;
    const shares = (budget - cost) / open;
    book.cash -= budget;
    book.positions.set(buy.symbol, {
      shares,
      avgPrice: open,
      cashOut: budget,
      slotKind: buy.slotKind,
      entrySession: buy.executionDate,
      dipEntrySession: buy.dipEntrySession ?? null,
      fallbackRank: buy.fallbackRank ?? null,
    });
    fills.push({
      ...buy,
      shares,
      price: open,
      notional: budget,
      cost,
    });
  }

  return { fills, skipped, trades };
}

export function applyTargetMetadata(book, target) {
  for (const row of target) {
    const position = book.positions.get(row.symbol);
    if (!position) continue;
    position.slotKind = row.slotKind;
    position.fallbackRank = row.fallbackRank;
    if (row.dipEntrySession) position.dipEntrySession = row.dipEntrySession;
    if (row.slotKind !== 'signal') position.dipEntrySession = null;
  }
}
