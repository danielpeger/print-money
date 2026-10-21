import { log } from './log.js';
import { renderRunSummary, RUN_SUMMARY_FROM, RUN_SUMMARY_TO, textToHtml } from './summary.js';

const RESEND_EMAILS = 'https://api.resend.com/emails';

export async function sendRunSummary(result, env = process.env, fetchImpl = globalThis.fetch) {
  const key = env?.RESEND_KEY;
  if (!key) {
    log('info', { runId: result?.runId, message: 'summary_email_skipped', detail: 'missing RESEND_KEY' });
    return { ok: false, skipped: true };
  }
  const { subject, text } = renderRunSummary(result);
  const to = env.RESEND_TO || RUN_SUMMARY_TO;
  const from = env.RESEND_FROM || RUN_SUMMARY_FROM;
  try {
    const response = await fetchImpl(RESEND_EMAILS, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
        'idempotency-key': String(result?.runId || subject).slice(0, 256),
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text,
        html: textToHtml(text),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      log('error', {
        runId: result?.runId,
        message: 'summary_email_failed',
        status: response.status,
        detail: body.slice(0, 300),
      });
      return { ok: false, status: response.status };
    }
    log('info', { runId: result?.runId, message: 'summary_email_sent' });
    return { ok: true };
  } catch (error) {
    log('error', { runId: result?.runId, message: 'summary_email_failed', detail: error.message });
    return { ok: false };
  }
}
