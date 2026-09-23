const https = require('https');
const crypto = require('crypto');

/**
 * Minimal Paystack REST client using Node's built-in `https` module — the app
 * has no HTTP client dependency and this backend runs on Node 16 (no global
 * `fetch`), so this avoids adding one for these calls.
 */

/** Makes one Paystack API call and resolves with `data.data`. Throws (with
 *  `.status`) on any non-2xx response, a `status: false` envelope, or a
 *  network failure, so callers can just await it. */
function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : undefined;
    const options = {
      hostname: 'api.paystack.co',
      path,
      method,
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };

    const req = https.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        let parsed;
        try {
          parsed = JSON.parse(responseBody);
        } catch {
          return reject(Object.assign(new Error('Paystack returned an invalid response'), { status: 502 }));
        }
        if (res.statusCode < 200 || res.statusCode >= 300 || !parsed.status) {
          return reject(Object.assign(new Error(parsed.message || 'Paystack request failed'), { status: 502 }));
        }
        resolve(parsed.data);
      });
    });

    req.on('error', (err) => reject(Object.assign(new Error(`Could not reach Paystack: ${err.message}`), { status: 502 })));
    if (payload) req.write(payload);
    req.end();
  });
}

/** GETs Paystack's transaction-verify endpoint — works for both Inline
 *  (card) checkouts and Charge API (mobile money) transactions alike. */
function verifyTransaction(reference) {
  return request('GET', `/transaction/verify/${encodeURIComponent(reference)}`);
}

/**
 * Initiates a mobile money charge (Charge API, not Inline) for a Ghanaian
 * provider. `data.status` in the response tells the caller what happens
 * next: 'success' (rare, immediate), 'send_otp' (caller must collect and
 * submit a one-time code), or 'pay_offline' (customer approves a prompt on
 * their own phone — poll `verifyTransaction` for the outcome).
 */
function initiateMobileMoneyCharge({ email, amountPesewas, reference, phone, provider }) {
  return request('POST', '/charge', {
    email,
    amount: String(amountPesewas),
    reference,
    mobile_money: { phone, provider },
  });
}

/** Submits a one-time code for a charge that came back `send_otp`. */
function submitOtp({ otp, reference }) {
  return request('POST', '/charge/submit_otp', { otp, reference });
}

/** Validates the `x-paystack-signature` header on a webhook request: an
 *  HMAC-SHA512 of the *raw* request body, keyed with the secret key. */
function isValidWebhookSignature(rawBody, signatureHeader) {
  if (!signatureHeader || !process.env.PAYSTACK_SECRET_KEY) return false;
  const expected = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch {
    // Buffers of different length throw rather than return false.
    return false;
  }
}

module.exports = { verifyTransaction, initiateMobileMoneyCharge, submitOtp, isValidWebhookSignature };
