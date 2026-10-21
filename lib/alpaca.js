import { nyDateFromIso, zonedDateTimeToUtc } from './calendar.js';

function paperBase(env) {
  let base = (env.APCA_API_BASE_URL || 'https://paper-api.alpaca.markets/v2').replace(/\/$/, '');
  if (!base.startsWith('https://paper-api.alpaca.markets')) {
    const error = new Error('This deployment only submits Alpaca paper orders.');
    error.code = 'live_refused';
    throw error;
  }
  if (!base.endsWith('/v2')) base += '/v2';
  return base;
}

async function readBody(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 200) };
  }
}

export function createAlpaca({ key, secret, env }) {
  const base = paperBase(env);
  const headers = {
    'APCA-API-KEY-ID': key,
    'APCA-API-SECRET-KEY': secret,
    'content-type': 'application/json',
  };

  async function request(url, { method = 'GET', body, retry = false } = {}) {
    let attempt = 0;
    while (true) {
      attempt += 1;
      let response;
      try {
        response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(20000),
        });
      } catch (error) {
        if (error.name === 'TimeoutError' || error.name === 'AbortError') {
          const uncertain = new Error('Alpaca request timed out');
          uncertain.uncertain = true;
          throw uncertain;
        }
        throw error;
      }
      if (retry && attempt < 3 && (response.status === 429 || response.status >= 500)) {
        await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
        continue;
      }
      const payload = await readBody(response);
      if (!response.ok) {
        const failure = new Error(payload?.message || `Alpaca ${method} ${response.status}`);
        failure.status = response.status;
        throw failure;
      }
      return payload;
    }
  }

  return {
    async account() {
      return request(`${base}/account`, { retry: true });
    },
    async positions() {
      return request(`${base}/positions`, { retry: true });
    },
    async openOrders() {
      return request(`${base}/orders?status=open&limit=500`, { retry: true });
    },
    async asset(symbol) {
      try {
        return await request(`${base}/assets/${encodeURIComponent(symbol)}`, { retry: true });
      } catch (error) {
        if (error.status === 404) return null;
        throw error;
      }
    },
    async findByClientOrderId(clientOrderId) {
      const params = new URLSearchParams({ client_order_id: clientOrderId });
      try {
        return await request(`${base}/orders:by_client_order_id?${params}`, { retry: true });
      } catch (error) {
        if (error.status === 404) return null;
        throw error;
      }
    },
    async submit(order) {
      return request(`${base}/orders`, { method: 'POST', body: order, retry: false });
    },
    async bars(symbols, start, end) {
      const collected = new Map(symbols.map((symbol) => [symbol, []]));
      let pageToken = null;
      do {
        const params = new URLSearchParams({
          symbols: symbols.join(','),
          timeframe: '1Day',
          start,
          end,
          limit: '10000',
          adjustment: 'all',
          feed: 'sip',
        });
        if (pageToken) params.set('page_token', pageToken);
        const body = await request(`https://data.alpaca.markets/v2/stocks/bars?${params}`, { retry: true });
        for (const [symbol, rows] of Object.entries(body.bars || {})) {
          const list = collected.get(symbol);
          if (!list) continue;
          for (const row of rows) {
            list.push({
              date: nyDateFromIso(row.t),
              open: row.o,
              high: row.h,
              low: row.l,
              close: row.c,
              volume: row.v,
            });
          }
        }
        pageToken = body.next_page_token || null;
      } while (pageToken);
      return collected;
    },
    async openingQuotes(symbols, sessionDate) {
      const grouped = new Map(symbols.map((symbol) => [symbol, []]));
      let pageToken = null;
      const start = zonedDateTimeToUtc(sessionDate, 9, 30);
      const end = zonedDateTimeToUtc(sessionDate, 9, 31);
      do {
        const params = new URLSearchParams({
          symbols: symbols.join(','),
          start: start.toISOString(),
          end: end.toISOString(),
          feed: 'sip',
          limit: '10000',
        });
        if (pageToken) params.set('page_token', pageToken);
        const body = await request(`https://data.alpaca.markets/v2/stocks/quotes?${params}`, { retry: true });
        for (const [symbol, rows] of Object.entries(body.quotes || {})) {
          const list = grouped.get(symbol);
          if (list) list.push(...rows);
        }
        pageToken = body.next_page_token || null;
      } while (pageToken);
      const found = new Map();
      for (const [symbol, rows] of grouped) {
        const chosen = selectOpeningQuote(rows, sessionDate);
        if (chosen) found.set(symbol, chosen);
      }
      return found;
    },
  };
}

export function selectOpeningQuote(quotes, sessionDate) {
  const start = zonedDateTimeToUtc(sessionDate, 9, 30).getTime();
  const end = zonedDateTimeToUtc(sessionDate, 9, 31).getTime();
  let best = null;
  for (const quote of quotes) {
    const at = Date.parse(quote.t);
    if (Number.isNaN(at) || at < start || at >= end) continue;
    if (!(quote.bp > 0) || !(quote.ap >= quote.bp)) continue;
    if (best && Date.parse(best.quote_at) <= at) continue;
    best = {
      quote_at: quote.t,
      bid: quote.bp,
      ask: quote.ap,
      bid_size: quote.bs ?? null,
      ask_size: quote.as ?? null,
    };
  }
  return best;
}
