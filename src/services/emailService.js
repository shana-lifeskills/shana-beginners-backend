// The Resend SDK calls out via the global `fetch`, which Node only ships
// natively from v18+. This backend is sometimes run under older local Node
// versions (see nvm setup), so polyfill it defensively rather than assume.
if (typeof fetch === 'undefined') {
  const crossFetch = require('cross-fetch');
  global.fetch = crossFetch;
  global.Headers = crossFetch.Headers;
  global.Request = crossFetch.Request;
  global.Response = crossFetch.Response;
}

const { Resend } = require('resend');

let resendClient = null;

/** Lazily builds the Resend client from RESEND_API_KEY. Returns null if it
 *  isn't configured — callers fall back to logging the email instead. */
function getResendClient() {
  if (resendClient) return resendClient;
  if (!process.env.RESEND_API_KEY) return null;

  resendClient = new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}

/**
 * Shared send path for every transactional email this service sends. If
 * RESEND_API_KEY isn't set (TEMPORARY DEMO BYPASS), logs the content to the
 * server console instead of failing the caller outright — remove this
 * fallback once the app has its own verified sending domain on Resend.
 * Never throws — a failed send shouldn't block registration/login/whatever
 * triggered it, but it is always visible in the logs either way.
 */
async function sendEmail({ to, subject, text, html, logLabel }) {
  const resend = getResendClient();
  if (!resend) {
    console.log(`[emailService] RESEND_API_KEY not set — ${logLabel} for ${to}:\n  ${text}`);
    return;
  }

  const { data, error } = await resend.emails.send({
    // Resend only accepts a custom "from" address once its domain is
    // verified in the dashboard. Until EMAIL_FROM is set to an address on a
    // verified domain, fall back to Resend's own sandbox sender so sending
    // doesn't fail outright — see the .env comment next to RESEND_API_KEY.
    from: process.env.EMAIL_FROM || 'ShanaLifeSkills <onboarding@resend.dev>',
    to,
    subject,
    text,
    html,
  });

  if (error) {
    console.error(`[emailService] Resend failed to send ${logLabel} to ${to}:`, error);
    return;
  }

  // Logged on every successful call (not just failures) so "did it actually
  // send?" is answerable from the server log instead of guessed at — the
  // id can be cross-checked against the Resend dashboard's activity log.
  console.log(`[emailService] Resend accepted ${logLabel} for ${to} — id ${data?.id}`);
}

/** Sends the "verify your email" message. */
async function sendVerificationEmail(user, verifyUrl) {
  await sendEmail({
    to: user.email,
    subject: 'Verify your ShanaLifeSkills email',
    text: `Hi ${user.firstName},\n\nPlease verify your email address by visiting:\n${verifyUrl}\n\nThis link expires in 24 hours.`,
    html: `<p>Hi ${user.firstName},</p><p>Please verify your email address by clicking the link below:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>This link expires in 24 hours.</p>`,
    logLabel: 'verification email',
  });
}

/**
 * Sends the month-end "you haven't paid yet" nudge to a student whose
 * `hasPaid` is still false as the month is about to end (see
 * paymentReminderService for the trigger window/dedupe logic).
 */
async function sendPaymentReminderEmail(user, { daysUntilMonthEnd }) {
  const dashboardUrl = `${process.env.CLIENT_URL || 'http://localhost:4200'}/student`;
  const dayWord = daysUntilMonthEnd === 1 ? 'day' : 'days';
  const urgency =
    daysUntilMonthEnd === 0
      ? "today's the last day of the month"
      : `only ${daysUntilMonthEnd} ${dayWord} left this month`;

  await sendEmail({
    to: user.email,
    subject: "Don't miss next month's new module — complete your payment",
    text: `Hi ${user.firstName},\n\nJust a heads up — ${urgency}, and next month's module starts soon after. Your account is still marked as unpaid, so complete your payment now to keep learning without interruption.\n\nComplete payment: ${dashboardUrl}`,
    html: `<p>Hi ${user.firstName},</p><p>Just a heads up — ${urgency}, and next month's module starts soon after. Your account is still marked as unpaid, so complete your payment now to keep learning without interruption.</p><p><a href="${dashboardUrl}">Complete payment</a></p>`,
    logLabel: 'payment reminder email',
  });
}

module.exports = { sendVerificationEmail, sendPaymentReminderEmail };
