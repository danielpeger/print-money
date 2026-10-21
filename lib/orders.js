export function clientOrderId({ book, executionDate, symbol, side }) {
  const code = book === 'trend' ? 't' : book === 'dip' ? 'd' : 'c';
  const day = executionDate.replaceAll('-', '');
  const ticker = symbol.replaceAll('.', '_');
  return `${code}-${day}-${ticker}-${side}`;
}

/**
 * Submit each intent once. A second call sees the broker row and does not post again.
 * A timeout queries the client id before any further post.
 */
export async function submitIntents(intents, broker) {
  const results = [];
  for (const intent of intents) {
    const existing = await broker.findByClientOrderId(intent.clientOrderId);
    if (existing) {
      results.push({ ...intent, status: 'already_present', brokerOrderId: existing.id, submitted: false });
      continue;
    }
    try {
      const created = await broker.submit(intent);
      results.push({ ...intent, status: created.status || 'submitted', brokerOrderId: created.id, submitted: true });
    } catch (error) {
      if (error.uncertain) {
        const after = await broker.findByClientOrderId(intent.clientOrderId);
        if (after) {
          results.push({ ...intent, status: 'already_present', brokerOrderId: after.id, submitted: false });
        } else {
          results.push({ ...intent, status: 'uncertain', submitted: false, error: 'timeout' });
        }
      } else {
        results.push({ ...intent, status: 'rejected', submitted: false, error: error.message || 'rejected' });
      }
    }
  }
  return results;
}
