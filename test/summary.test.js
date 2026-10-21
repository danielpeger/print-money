import assert from 'node:assert/strict';
import test from 'node:test';
import { redact } from '../lib/env.js';
import { sendRunSummary } from '../lib/mail.js';
import { renderRunSummary, RUN_SUMMARY_FROM, RUN_SUMMARY_TO, textToHtml } from '../lib/summary.js';

test('a skip while the cash session is open explains the clock', () => {
  const { subject, text } = renderRunSummary({
    runId: '20261014-c9f4f9dc',
    status: 'skipped_data_not_ready',
    reason: 'session_not_closed',
    sessionDate: '2026-10-14',
    nyDate: '2026-10-14',
    dryRun: false,
  });
  assert.equal(subject, 'Paper books: skipped, session still open');
  assert.match(text, /14 October 2026/);
  assert.match(text, /still open/);
  assert.match(text, /16:15 New York/);
  assert.match(text, /stopped before planning new orders/);
  assert.match(text, /20261014-c9f4f9dc/);
});

test('a holiday skip does not claim a session was used', () => {
  const { subject, text } = renderRunSummary({
    runId: '20261126-aaaa',
    status: 'skipped_data_not_ready',
    reason: 'not_a_session',
    sessionDate: null,
    nyDate: '2026-11-26',
    dryRun: false,
  });
  assert.equal(subject, 'Paper books: skipped, not a session');
  assert.match(text, /26 November 2026/);
  assert.match(text, /did not trade/);
  assert.match(text, /weekend or a full NYSE holiday/);
});

test('a Saturday catch-up names the Friday session and the Monday open', () => {
  const { subject, text } = renderRunSummary({
    runId: '20261016-catchup',
    status: 'orders_submitted',
    reason: 'prior_session',
    sessionDate: '2026-10-16',
    nyDate: '2026-10-17',
    executionDate: '2026-10-19',
    dryRun: false,
    books: {
      trend: {
        equity: 5000,
        deployable: 5000,
        orders: [{ symbol: 'DIS', side: 'buy', notional: 200, reason: 'Buy DIS. It qualifies for Trend.' }],
        submission: [{ symbol: 'DIS', side: 'buy', status: 'accepted', error: null }],
      },
    },
  });
  assert.equal(subject, 'Paper books: submitted orders for 16 October 2026');
  assert.match(text, /used the 16 October 2026 session/);
  assert.match(text, /latest completed regular session/);
  assert.match(text, /19 October 2026 open/);
  assert.match(text, /New paper orders were submitted/);
});

test('a prior-session reconcile names holdings and why nothing was sent', () => {
  const { subject, text } = renderRunSummary({
    runId: '20261013-f2b5da72',
    status: 'reconciled',
    reason: 'prior_session',
    sessionDate: '2026-10-13',
    executionDate: '2026-10-14',
    dryRun: false,
    detail: {
      killSwitch: false,
      quoteGaps: [],
      adopted: [],
      fills: {
        trend: [{
          symbol: 'AAPL',
          side: 'buy',
          shares: 0.966145,
          fillPrice: 345,
          spreadCost: 0.323659,
          reason: 'Buy AAPL. It qualifies for Trend: the close 340.97 is above the 200-day SMA 290.75, and 12-to-1 momentum is positive at 30.1%. That momentum ranks it 8 among live names.',
        }],
        dip: [],
        control: [],
      },
    },
    books: {
      trend: {
        equity: 5012.1,
        deployable: 5000,
        opening: false,
        orders: [],
        skipped: [],
        target: [
          { symbol: 'AAPL', slotKind: 'signal' },
          { symbol: 'DELL', slotKind: 'signal' },
        ],
      },
      dip: {
        equity: 5008,
        deployable: 5000,
        opening: false,
        orders: [],
        skipped: [],
        target: [
          { symbol: 'SNDK', slotKind: 'signal' },
          { symbol: 'AAPL', slotKind: 'fallback' },
        ],
      },
      control: {
        equity: 4990,
        deployable: 5000,
        opening: false,
        orders: [],
        skipped: [],
        target: [],
      },
    },
  });
  assert.equal(subject, 'Paper books: reconciled 13 October 2026');
  assert.match(text, /latest completed regular session/);
  assert.match(text, /14 October 2026 open/);
  assert.match(text, /Existing fills were reconciled\. No new order was required/);
  assert.match(text, /Trend booked a fill/);
  assert.match(text, /bought 0.966145 AAPL at \$345.00/);
  assert.match(text, /Spread versus the open midpoint was \$0.32/);
  assert.match(text, /12-to-1 momentum is positive at 30.1%/);
  assert.match(text, /No slot changed\. The book keeps AAPL \(signal\) and DELL \(signal\)/);
  assert.match(text, /Control already opened/);
  assert.match(text, /does not trade again/);
});

test('submitted orders keep the rule text and broker status', () => {
  const { subject, text } = renderRunSummary({
    runId: '20261012-ab6c84ae',
    status: 'orders_submitted',
    reason: 'session_closed',
    sessionDate: '2026-10-12',
    executionDate: '2026-10-13',
    dryRun: false,
    detail: { killSwitch: false, quoteGaps: ['FIG'] },
    books: {
      trend: {
        equity: 100000,
        deployable: 5000,
        opening: true,
        orders: [{
          symbol: 'AAPL',
          side: 'buy',
          notional: 333.33,
          reason: 'Buy AAPL on the start session. The slot is a signal. The close 340.97 is above the 200-day SMA 290.75, and 12-to-1 momentum is positive at 30.1%. That momentum ranks it 8 among live names.',
        }],
        skipped: [{ symbol: 'PFE', side: 'buy', reason: 'below_min_notional' }],
        submission: [{ symbol: 'AAPL', side: 'buy', status: 'accepted', error: null }],
        target: [{ symbol: 'AAPL', slotKind: 'signal' }],
      },
    },
  });
  assert.equal(subject, 'Paper books: submitted orders for 12 October 2026');
  assert.match(text, /New paper orders were submitted/);
  assert.match(text, /opening run for Trend/);
  assert.match(text, /Buy AAPL on the start session/);
  assert.match(text, /Notional \$333.33/);
  assert.match(text, /Broker status: accepted/);
  assert.match(text, /Buy skipped: A buy of PFE would be below the \$1 minimum notional/);
  assert.match(text, /Opening SIP quotes were missing for FIG/);
});

test('kill switch and dry run are stated in the outcome', () => {
  const killed = renderRunSummary({
    runId: 'k1',
    status: 'reconciled',
    reason: 'session_closed',
    sessionDate: '2026-10-13',
    executionDate: '2026-10-14',
    dryRun: false,
    detail: { killSwitch: true },
    books: {
      trend: {
        orders: [{ symbol: 'DIS', side: 'buy', notional: 200, reason: 'Buy DIS. It qualifies for Trend.' }],
        submission: [],
      },
    },
  });
  assert.match(killed.text, /kill switch is on/);
  assert.match(killed.text, /blocked sending this to Alpaca/);

  const dry = renderRunSummary({
    runId: 'd1',
    status: 'orders_submitted',
    reason: 'session_closed',
    sessionDate: '2026-10-13',
    executionDate: '2026-10-14',
    dryRun: true,
    books: {
      dip: {
        orders: [{ symbol: 'HPQ', side: 'buy', notional: 500, reason: 'Buy HPQ. It qualifies for Dip.' }],
      },
    },
  });
  assert.match(dry.text, /woke as a dry run/);
  assert.match(dry.text, /nothing was sent to Alpaca/);
  assert.match(dry.text, /Dry run: not submitted/);
});

test('a failed unexpected position is the subject and the body', () => {
  const { subject, text } = renderRunSummary({
    runId: '20261013-53330416',
    status: 'failed',
    reason: 'session_closed',
    sessionDate: '2026-10-13',
    error: 'unexpected_position AAPL (trend)',
    detail: {
      adopted: [{ book: 'dip', adopted: [{ symbol: 'SPCX' }] }],
    },
  });
  assert.equal(subject, 'Paper books: failed on 13 October 2026 — unexpected position');
  assert.match(text, /The run failed: unexpected_position AAPL \(trend\)/);
  assert.match(text, /No new order was submitted/);
  assert.match(text, /Dip adopted SPCX from this book's own buy intent/);
});

test('waiting signals and waitlisted names are named with the rule that held them', () => {
  const { text } = renderRunSummary({
    runId: '20261015-wait',
    status: 'reconciled',
    reason: 'session_closed',
    sessionDate: '2026-10-15',
    executionDate: '2026-10-16',
    books: {
      trend: {
        equity: 5000,
        deployable: 5000,
        orders: [],
        skipped: [],
        target: [{ symbol: 'AAPL', slotKind: 'signal' }],
        waiting: [
          { symbol: 'AAPL', reason: 'one_session_fail' },
          { symbol: 'DIS', reason: 'no_slot' },
          { symbol: 'NFLX', reason: 'no_slot' },
        ],
      },
      dip: {
        equity: 5000,
        deployable: 5000,
        orders: [],
        skipped: [],
        target: [{ symbol: 'SNDK', slotKind: 'signal' }],
        waiting: [
          { symbol: 'HPQ', reason: 'one_session_dip' },
          { symbol: 'NKE', reason: 'one_session_dip' },
          { symbol: 'F', reason: 'weakest_dip' },
        ],
      },
    },
  });
  assert.match(text, /No slot changed\. The book keeps AAPL \(signal\)/);
  assert.match(text, /AAPL failed Trend today and stays\. It has not also failed on the prior session/);
  assert.match(text, /DIS and NFLX qualify and wait for a slot/);
  assert.match(text, /HPQ and NKE are Dips today and wait\. They were not already a dip on the prior session/);
  assert.match(text, /F is the weakest new Dip today, so it does not take a slot/);
});

test('html wraps paragraphs and escapes markup', () => {
  const html = textToHtml('Buy AAPL.\nKeep it.\n\nDip sold <HPQ> & more.');
  assert.match(html, /<p>Buy AAPL\.<br>Keep it\.<\/p>/);
  assert.match(html, /&lt;HPQ&gt; &amp; more/);
});

test('sendRunSummary posts the rendered mail through Resend', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, status: 200, text: async () => '{"id":"email_1"}' };
  };
  const result = await sendRunSummary({
    runId: '20261013-mail',
    status: 'reconciled',
    reason: 'session_closed',
    sessionDate: '2026-10-13',
    executionDate: '2026-10-14',
  }, { RESEND_KEY: 're_test_key' }, fetchImpl);
  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.resend.com/emails');
  assert.equal(calls[0].options.headers.authorization, 'Bearer re_test_key');
  assert.equal(calls[0].options.headers['idempotency-key'], '20261013-mail');
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.from, RUN_SUMMARY_FROM);
  assert.deepEqual(body.to, [RUN_SUMMARY_TO]);
  assert.equal(body.subject, 'Paper books: reconciled 13 October 2026');
  assert.match(body.text, /Existing fills were reconciled/);
  assert.match(body.html, /Existing fills were reconciled/);
});

test('sendRunSummary can override the from and to addresses', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, status: 200, text: async () => '{}' };
  };
  await sendRunSummary(
    { runId: 'x', status: 'skipped_concurrent', sessionDate: '2026-10-13' },
    { RESEND_KEY: 're_test', RESEND_FROM: 'Books <alerts@example.com>', RESEND_TO: 'other@example.com' },
    fetchImpl,
  );
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.from, 'Books <alerts@example.com>');
  assert.deepEqual(body.to, ['other@example.com']);
});

test('sendRunSummary skips without a key and does not throw on a Resend error', async () => {
  const skipped = await sendRunSummary({ runId: 'none', status: 'reconciled' }, {}, async () => {
    throw new Error('should not fetch');
  });
  assert.deepEqual(skipped, { ok: false, skipped: true });

  const failed = await sendRunSummary(
    { runId: 'bad', status: 'failed', error: 'nope' },
    { RESEND_KEY: 're_test' },
    async () => ({ ok: false, status: 403, text: async () => 'domain is not verified' }),
  );
  assert.equal(failed.ok, false);
  assert.equal(failed.status, 403);
});

test('resend keys are redacted', () => {
  assert.equal(redact({ RESEND_KEY: 're_live_secret' }).RESEND_KEY, '[redacted]');
  assert.equal(redact('re_live_secret'), '[redacted]');
});
