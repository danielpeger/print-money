import { BOOKS } from './config.js';
import { formatNumber, formatUsd } from './dates.js';

export const RUN_SUMMARY_TO = 'pegerdaniel@gmail.com';
export const RUN_SUMMARY_FROM = 'Basket books <onboarding@resend.dev>';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const BOOK_ORDER = ['trend', 'dip', 'control'];

const CLOCK = {
  not_a_session: 'New York is on a weekend or a full NYSE holiday, so this wake-up is not a trading session.',
  session_not_closed: 'The US cash session is still open, or the 15-minute SIP delay has not passed. The job waits until 16:15 New York.',
  prior_session: 'The job used the latest completed regular session\'s bars. That is the most recent close that is already finalized.',
  session_closed: 'The US cash session is closed. The job used this session\'s completed bars.',
};

const SKIP = {
  not_eligible: (symbol) => `${symbol} is not eligible: it is not tradable and fractionable, or it has no signal bar.`,
  below_min_notional: (symbol) => `A buy of ${symbol} would be below the $1 minimum notional.`,
  no_bar_on_execution_session: (symbol) => `${symbol} has no bar on the execution session, so it cannot fill at that open.`,
  paired_sell_skipped: (symbol) => `The matching sell for ${symbol} was skipped, so this buy was not sent.`,
  slot_left_in_cash: (symbol) => `The slot that would have bought ${symbol} was left in cash.`,
  no_position: (symbol) => `There is no ${symbol} position to sell.`,
  no_open: (symbol) => `${symbol} has no open price.`,
  opening_in_flight: () => 'Opening orders are already at the broker. This book waits for them to fill and does not send them again.',
};

export function formatSessionDate(iso) {
  if (!iso) return null;
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return iso;
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

export function renderRunSummary(result = {}) {
  const paragraphs = [];
  paragraphs.push(lede(result));
  const clock = clockParagraph(result);
  if (clock) paragraphs.push(clock);
  paragraphs.push(outcomeParagraph(result));
  const adopted = adoptedParagraph(result);
  if (adopted) paragraphs.push(adopted);
  const fills = fillsParagraphs(result);
  paragraphs.push(...fills);
  paragraphs.push(...bookParagraphs(result));
  const gaps = quoteGapParagraph(result);
  if (gaps) paragraphs.push(gaps);
  paragraphs.push(`Run id ${result.runId || 'unknown'}.`);
  const text = paragraphs.filter(Boolean).join('\n\n');
  return { subject: subjectFor(result), text };
}

export function textToHtml(text) {
  const escaped = String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
  const body = escaped
    .split('\n\n')
    .map((block) => `<p>${block.replaceAll('\n', '<br>')}</p>`)
    .join('');
  return `<div style="font-family:Georgia,serif;font-size:16px;line-height:1.5;color:#111">${body}</div>`;
}

function subjectFor(result) {
  const session = formatSessionDate(result.sessionDate);
  const status = result.status || 'unknown';
  if (status === 'failed') {
    const hint = shortError(result.error);
    return session
      ? `Paper books: failed on ${session}${hint ? ` — ${hint}` : ''}`
      : `Paper books: failed${hint ? ` — ${hint}` : ''}`;
  }
  if (status === 'orders_submitted') {
    return session ? `Paper books: submitted orders for ${session}` : 'Paper books: submitted orders';
  }
  if (status === 'reconciled') {
    return session ? `Paper books: reconciled ${session}` : 'Paper books: reconciled';
  }
  if (status === 'skipped_concurrent') {
    return session ? `Paper books: skipped ${session}, another run holds the lock` : 'Paper books: skipped, another run holds the lock';
  }
  if (status === 'skipped_data_not_ready') {
    if (result.reason === 'not_a_session') return 'Paper books: skipped, not a session';
    if (result.reason === 'session_not_closed') return 'Paper books: skipped, session still open';
    if (staleLatest(result)) return session ? `Paper books: skipped ${session}, bars are stale` : 'Paper books: skipped, bars are stale';
    return session ? `Paper books: skipped ${session}` : 'Paper books: skipped';
  }
  return session ? `Paper books: ${status} on ${session}` : `Paper books: ${status}`;
}

function lede(result) {
  const dry = result.dryRun ? ' as a dry run' : '';
  if (result.status === 'skipped_data_not_ready' && result.reason === 'not_a_session') {
    const day = formatSessionDate(result.nyDate) || 'today';
    return `The paper job woke${dry} on ${day} and did not trade.`;
  }
  const session = formatSessionDate(result.sessionDate);
  if (!session) return `The paper job woke${dry}.`;
  return `The paper job woke${dry} and used the ${session} session.`;
}

function clockParagraph(result) {
  const stale = staleLatest(result);
  if (stale) {
    return `Daily bars are not ready. The latest completed bar is ${stale}, which does not match the session, so the job recorded a skip and sent no order.`;
  }
  if (result.status === 'skipped_concurrent') {
    const session = formatSessionDate(result.sessionDate);
    return session
      ? `Another run already holds the ${session} lock. This invocation exited without submitting anything.`
      : 'Another run already holds the session lock. This invocation exited without submitting anything.';
  }
  const clock = CLOCK[result.reason];
  if (!clock) return null;
  const execution = formatSessionDate(result.executionDate);
  if ((result.reason === 'prior_session' || result.reason === 'session_closed') && execution) {
    return `${clock} Any new order would take the ${execution} open.`;
  }
  return clock;
}

function outcomeParagraph(result) {
  const bits = [];
  if (result.status === 'failed') {
    bits.push(`The run failed: ${result.error || 'unknown error'}. No new order was submitted.`);
  } else if (result.status === 'orders_submitted') {
    bits.push(result.dryRun
      ? 'Orders were calculated. Because this was a dry run, nothing was sent to Alpaca.'
      : 'New paper orders were submitted.');
  } else if (result.status === 'reconciled') {
    bits.push('Existing fills were reconciled. No new order was required.');
  } else if (result.status === 'skipped_data_not_ready' || result.status === 'skipped_concurrent') {
    bits.push('The run stopped before planning new orders.');
  } else {
    bits.push(`The run finished as ${result.status || 'unknown'}.`);
  }
  if (result.detail?.killSwitch || result.killSwitch) {
    bits.push('The kill switch is on, so new intents are recorded as blocked and are not sent to the broker. Held names are not sold.');
  }
  return bits.join(' ');
}

function adoptedParagraph(result) {
  const rows = result.detail?.adopted || result.adopted || [];
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const parts = [];
  for (const row of rows) {
    const book = bookName(row.book);
    const names = (row.adopted || []).map((item) => item.symbol || item).filter(Boolean);
    if (names.length === 0) continue;
    parts.push(`${book} adopted ${joinNames(names)} from this book's own buy intent, so the broker lot is now in book state.`);
  }
  return parts.length > 0 ? parts.join(' ') : null;
}

function fillsParagraphs(result) {
  const paragraphs = [];
  const byBook = fillsByBook(result);
  for (const code of BOOK_ORDER) {
    const fills = byBook[code] || [];
    if (fills.length === 0) continue;
    const sentences = fills.map((fill) => fillSentence(fill));
    paragraphs.push(`${bookName(code)} booked ${fills.length === 1 ? 'a fill' : `${fills.length} fills`}. ${sentences.join(' ')}`);
  }
  return paragraphs;
}

function bookParagraphs(result) {
  const books = result.books || {};
  const paragraphs = [];
  for (const code of BOOK_ORDER) {
    const book = books[code];
    if (!book) continue;
    paragraphs.push(bookParagraph(code, book, result));
  }
  if (paragraphs.length === 0 && result.status === 'orders_submitted') {
    paragraphs.push('No book detail was recorded.');
  }
  return paragraphs;
}

function bookParagraph(code, book, result) {
  const name = bookName(code);
  const lines = [bookHeader(name, book)];
  if (book.opening) {
    lines.push(`This is the opening run for ${name}.`);
  }
  if (code === 'control' && !book.opening && (!book.orders || book.orders.length === 0)) {
    lines.push('Control already opened. It bought the basket in equal dollars on the start session and does not trade again.');
  }
  const orders = book.orders || [];
  if (orders.length === 0 && code !== 'control') {
    const target = describeTarget(book.target);
    lines.push(target
      ? `No slot changed. The book keeps ${target}.`
      : 'No slot changed, and no new order was planned.');
  }
  for (const order of orders) {
    lines.push(orderSentence(order, book, result));
  }
  for (const skip of book.skipped || []) {
    lines.push(skipSentence(skip));
  }
  lines.push(...waitingLines(book.waiting));
  const cooldown = (book.cooldown || []).map((row) => row.symbol || row).filter(Boolean);
  if (cooldown.length > 0) {
    lines.push(`Cooldown: ${joinNames(cooldown)}.`);
  }
  return lines.filter(Boolean).join('\n');
}

function waitingLines(waiting) {
  const groups = new Map();
  for (const row of waiting || []) {
    const symbol = row.symbol || row;
    if (!symbol) continue;
    const reason = row.reason || 'no_slot';
    if (!groups.has(reason)) groups.set(reason, []);
    groups.get(reason).push(symbol);
  }
  const lines = [];
  const fails = groups.get('one_session_fail') || [];
  if (fails.length === 1) {
    lines.push(`${fails[0]} failed Trend today and stays. It has not also failed on the prior session.`);
  } else if (fails.length > 1) {
    lines.push(`${joinNames(fails)} failed Trend today and stay. They have not also failed on the prior session.`);
  }
  const dips = groups.get('one_session_dip') || [];
  if (dips.length === 1) {
    lines.push(`${dips[0]} is a Dip today and waits. It was not already a dip on the prior session.`);
  } else if (dips.length > 1) {
    lines.push(`${joinNames(dips)} are Dips today and wait. They were not already a dip on the prior session.`);
  }
  const weakest = groups.get('weakest_dip') || [];
  if (weakest.length === 1) {
    lines.push(`${weakest[0]} is the weakest new Dip today, so it does not take a slot.`);
  } else if (weakest.length > 1) {
    lines.push(`${joinNames(weakest)} are the weakest new Dips today, so they do not take a slot.`);
  }
  const slots = groups.get('no_slot') || [];
  if (slots.length === 1) {
    lines.push(`${slots[0]} qualifies and waits for a slot.`);
  } else if (slots.length > 1) {
    lines.push(`${joinNames(slots)} qualify and wait for a slot.`);
  }
  return lines;
}

function bookHeader(name, book) {
  const equity = Number.isFinite(Number(book.equity)) ? ` Equity ${formatUsd(Number(book.equity))}.` : '';
  const deployable = Number.isFinite(Number(book.deployable)) ? ` Deployable ${formatUsd(Number(book.deployable))}.` : '';
  return `${name}.${equity}${deployable}`;
}

function orderSentence(order, book, result) {
  const reason = String(order.reason || '').trim() || fallbackOrderReason(order);
  const size = orderSize(order);
  const submitted = submissionFor(book, order);
  const blocked = result.detail?.killSwitch || result.killSwitch;
  const dry = result.dryRun;
  let suffix = '';
  if (blocked) suffix = ' The kill switch blocked sending this to Alpaca.';
  else if (dry) suffix = ' Dry run: not submitted.';
  else if (submitted) suffix = ` Broker status: ${submitted.status}${submitted.error ? ` (${submitted.error})` : ''}.`;
  return size ? `${reason} ${size}.${suffix}` : `${reason}${suffix}`;
}

function fallbackOrderReason(order) {
  const side = order.side === 'sell' ? 'Sell' : 'Buy';
  return `${side} ${order.symbol}.`;
}

function orderSize(order) {
  if (order.side === 'buy' && order.notional != null) return `Notional ${formatUsd(Number(order.notional))}`;
  if (order.side === 'sell' && order.qty != null) return `${formatNumber(Number(order.qty), 6)} shares`;
  return '';
}

function submissionFor(book, order) {
  const rows = book.submission || [];
  return rows.find((row) => row.symbol === order.symbol && row.side === order.side) || null;
}

function skipSentence(skip) {
  const reason = skip?.reason;
  if (reason === 'opening_in_flight') return SKIP.opening_in_flight();
  const fn = SKIP[reason];
  if (fn && skip.symbol) return `${skip.side === 'sell' ? 'Sell' : 'Buy'} skipped: ${fn(skip.symbol)}`;
  if (fn) return fn(skip.symbol);
  if (skip.symbol) return `${skip.side === 'sell' ? 'Sell' : 'Buy'} of ${skip.symbol} skipped (${reason || 'unspecified'}).`;
  return `A planned order was skipped (${reason || 'unspecified'}).`;
}

function describeTarget(target) {
  if (!Array.isArray(target) || target.length === 0) return '';
  return joinNames(target.map((row) => {
    const symbol = row.symbol || row;
    const kind = slotLabel(row.slotKind);
    return kind ? `${symbol} (${kind})` : symbol;
  }));
}

function slotLabel(kind) {
  if (kind === 'signal') return 'signal';
  if (kind === 'fallback') return 'fallback';
  if (kind === 'control') return 'control';
  return '';
}

function fillSentence(fill) {
  const side = fill.side === 'sell' ? 'sold' : 'bought';
  const shares = formatNumber(Number(fill.shares), 6);
  const price = formatUsd(Number(fill.fillPrice ?? fill.fill_price));
  const spread = fill.spreadCost ?? fill.spread_cost_usd;
  const spreadText = spread == null || Number.isNaN(Number(spread))
    ? ''
    : ` Spread versus the open midpoint was ${formatUsd(Number(spread))}.`;
  const why = fill.reason ? ` ${fill.reason}` : '';
  return `It ${side} ${shares} ${fill.symbol} at ${price}.${spreadText}${why}`.trim();
}

function quoteGapParagraph(result) {
  const gaps = result.detail?.quoteGaps || result.quoteGaps || [];
  if (!Array.isArray(gaps) || gaps.length === 0) return null;
  return `Opening SIP quotes were missing for ${joinNames(gaps)}. Spread versus the open midpoint could not be stored for those names.`;
}

function fillsByBook(result) {
  if (result.detail?.fills && typeof result.detail.fills === 'object') return result.detail.fills;
  const out = {};
  for (const code of BOOK_ORDER) {
    out[code] = result.books?.[code]?.fills || [];
  }
  return out;
}

function staleLatest(result) {
  if (result.detail?.reason === 'stale_bars') return result.detail.latest || 'none';
  if (result.reason === 'stale_bars') return result.detail?.latest || 'none';
  return null;
}

function shortError(error) {
  if (!error) return '';
  const text = String(error);
  if (text.includes('unexpected_position')) return 'unexpected position';
  if (text.includes('uncertain')) return 'uncertain order';
  if (text.length > 40) return `${text.slice(0, 37)}...`;
  return text;
}

function bookName(code) {
  return BOOKS[code]?.name || code;
}

function joinNames(names) {
  const list = names.filter(Boolean);
  if (list.length === 0) return '';
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list.slice(0, -1).join(', ')}, and ${list.at(-1)}`;
}
