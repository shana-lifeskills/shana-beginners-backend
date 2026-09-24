const nodemailer = require('nodemailer');

let transporter = null;

/** Lazily builds the SMTP transport from env vars. Returns null if SMTP
 *  isn't configured — callers fall back to logging the email instead. */
function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) return null;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  return transporter;
}

/**
 * Sends the "verify your email" message. If no SMTP server is configured
 * yet (TEMPORARY DEMO BYPASS), logs the verification link to the server
 * console instead of failing registration outright — remove this fallback
 * once real SMTP env vars (SMTP_HOST/PORT/USER/PASS) are set.
 */
async function sendVerificationEmail(user, verifyUrl) {
  const subject = 'Verify your ShanaLifeSkills email';
  const text = `Hi ${user.firstName},\n\nPlease verify your email address by visiting:\n${verifyUrl}\n\nThis link expires in 24 hours.`;
  const html = `<p>Hi ${user.firstName},</p><p>Please verify your email address by clicking the link below:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>This link expires in 24 hours.</p>`;

  const transport = getTransporter();
  if (!transport) {
    console.log(`[emailService] SMTP not configured — verification link for ${user.email}:\n  ${verifyUrl}`);
    return;
  }

  await transport.sendMail({
    from: process.env.SMTP_FROM || 'ShanaLifeSkills <no-reply@shanalifeskills.school>',
    to: user.email,
    subject,
    text,
    html,
  });
}

module.exports = { sendVerificationEmail };
