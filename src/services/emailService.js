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
 * Sends the "verify your email" message via Resend. If RESEND_API_KEY isn't
 * set (TEMPORARY DEMO BYPASS), logs the verification link to the server
 * console instead of failing registration outright — remove this fallback
 * once the app has its own verified sending domain on Resend.
 */
async function sendVerificationEmail(user, verifyUrl) {
  const subject = 'Verify your ShanaLifeSkills email';
  const text = `Hi ${user.firstName},\n\nPlease verify your email address by visiting:\n${verifyUrl}\n\nThis link expires in 24 hours.`;
  const html = `<p>Hi ${user.firstName},</p><p>Please verify your email address by clicking the link below:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>This link expires in 24 hours.</p>`;

  const resend = getResendClient();
  if (!resend) {
    console.log(`[emailService] RESEND_API_KEY not set — verification link for ${user.email}:\n  ${verifyUrl}`);
    return;
  }

  const { data, error } = await resend.emails.send({
    // Resend only accepts a custom "from" address once its domain is
    // verified in the dashboard. Until EMAIL_FROM is set to an address on a
    // verified domain, fall back to Resend's own sandbox sender so sending
    // doesn't fail outright — see the .env comment next to RESEND_API_KEY.
    from: process.env.EMAIL_FROM || 'ShanaLifeSkills <onboarding@resend.dev>',
    to: user.email,
    subject,
    text,
    html,
  });

  if (error) {
    // Same non-fatal handling as the earlier SMTP path: a failed send
    // shouldn't block registration, but it should be visible in the logs.
    console.error(`[emailService] Resend failed to send to ${user.email}:`, error);
    return;
  }

  // Logged on every successful call (not just failures) so "did it actually
  // send?" is answerable from the server log instead of guessed at — the
  // id can be cross-checked against the Resend dashboard's activity log.
  console.log(`[emailService] Resend accepted verification email for ${user.email} — id ${data?.id}`);
}

module.exports = { sendVerificationEmail };
