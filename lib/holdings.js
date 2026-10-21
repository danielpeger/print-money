/**
 * Broker lots must have slot metadata before a book can trade.
 *
 * A name at Alpaca with no book_state row is unexpected. If that lot is one of
 * this job's own buy intents, adopt it: copy slot_kind, entry session, and
 * fallback rank from the intent. A name with no matching buy is a true
 * orphan. Do not sell it and do not submit any new order. Alert and fail closed.
 *
 * already_present is this job's status, not Alpaca's. A same-day rerun can
 * stamp it onto an opening buy that has not been booked yet. Treat it as still
 * reconcilable.
 */

export const RECONCILE_INTENT_STATUSES = Object.freeze([
  'pending',
  'submitted',
  'accepted',
  'new',
  'pending_new',
  'partially_filled',
  'uncertain',
  'already_present',
]);

const BLOCKED_BUY_STATUSES = new Set(['rejected', 'blocked']);

export function brokerClass(order) {
  const status = order.status;
  const filled = Number(order.filled_qty) > 0;
  if (status === 'filled') return 'filled';
  if (status === 'partially_filled') return 'partial';
  if (['canceled', 'cancelled', 'expired', 'rejected', 'done_for_day'].includes(status)) {
    return filled ? 'partial' : 'closed';
  }
  if (['new', 'accepted', 'pending_new'].includes(status)) return 'open';
  return 'uncertain';
}

export function recordedIntentStatus(status) {
  return status === 'already_present' ? 'submitted' : status;
}

export function metaFromIntent(intent, code) {
  return {
    symbol: intent.symbol,
    slotKind: intent.slot_kind,
    entrySession: intent.session_date,
    dipEntrySession: code === 'dip' && intent.slot_kind === 'signal' ? intent.session_date : null,
    fallbackRank: intent.fallback_rank ?? null,
  };
}

export function applyFilledBuy(state, intent, code) {
  const positions = Array.isArray(state.positions) ? state.positions : [];
  const next = positions.filter((row) => row.symbol !== intent.symbol);
  next.push(metaFromIntent(intent, code));
  state.positions = next;
  state.opened = true;
}

export function applyFilledSell(state, intent) {
  const positions = Array.isArray(state.positions) ? state.positions : [];
  state.positions = positions.filter((row) => row.symbol !== intent.symbol);
  state.opened = true;
}

function intentOrder(a, b) {
  if (a.session_date !== b.session_date) return a.session_date < b.session_date ? -1 : 1;
  return (a.id || 0) - (b.id || 0);
}

function sellFilled(intent) {
  if (intent.status === 'filled') return true;
  return Number(intent.filled_qty) > 0;
}

export function latestAdoptiveBuy(intents, symbol) {
  let buy = null;
  for (const intent of [...(intents || [])].filter((row) => row.symbol === symbol).sort(intentOrder)) {
    if (intent.side === 'buy' && !BLOCKED_BUY_STATUSES.has(intent.status)) buy = intent;
    else if (intent.side === 'sell' && sellFilled(intent)) buy = null;
  }
  return buy;
}

/**
 * Copy slot metadata from this job's buy intents onto broker lots that have
 * none, and drop book_state rows the broker no longer holds.
 */
export function adoptBrokerHoldings({ brokerPositions, state, intents, code }) {
  const adopted = [];
  const unexpected = [];
  const held = new Set((brokerPositions || []).map((row) => row.symbol));
  const positions = Array.isArray(state.positions) ? [...state.positions] : [];
  const kept = positions.filter((row) => held.has(row.symbol));
  const known = new Set(kept.map((row) => row.symbol));
  for (const position of brokerPositions || []) {
    if (known.has(position.symbol)) continue;
    const intent = latestAdoptiveBuy(intents, position.symbol);
    if (intent) {
      kept.push(metaFromIntent(intent, code));
      known.add(position.symbol);
      adopted.push({
        symbol: position.symbol,
        clientOrderId: intent.client_order_id,
        slotKind: intent.slot_kind,
      });
      continue;
    }
    unexpected.push(position.symbol);
  }
  state.positions = kept;
  if (adopted.length > 0) state.opened = true;
  return { adopted, unexpected };
}

export function unexpectedSymbols(brokerPositions, statePositions) {
  const known = new Set((statePositions || []).map((row) => row.symbol));
  return (brokerPositions || [])
    .map((row) => row.symbol)
    .filter((symbol) => !known.has(symbol));
}

export function unexpectedMessage(book, symbols) {
  return `unexpected_position ${symbols.join(',')} (${book})`;
}
