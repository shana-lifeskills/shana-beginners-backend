const crypto = require('crypto');
const { sequelize, Payment, User } = require('../models');
const paystackClient = require('./paystackClient');

/** GH₵399.00 course-access price — server-owned, never trusted from the
 *  client. Overridable via env so pricing can change without a code deploy. */
const COURSE_ACCESS_AMOUNT_PESEWAS = parseInt(process.env.COURSE_ACCESS_AMOUNT_PESEWAS, 10) || 39900;

/** Paystack's Ghana mobile money provider codes — 'vod' is Paystack's (legacy
 *  Vodafone Cash) code for what's now branded Telecel Cash; the code itself
 *  hasn't changed on Paystack's side. */
const MOBILE_MONEY_PROVIDERS = ['mtn', 'vod', 'atl'];

// TEMPORARY DEMO BYPASS: the placeholder values shipped in .env until real
// Paystack keys are added. Treating these as "no real key" (not just an
// empty/missing one) means the demo bypass stays active while the dummy
// values are in place, and turns itself off the moment real keys replace
// them — nothing else needs to change when that happens.
const DUMMY_KEY_VALUES = new Set(['sk_test_dummy_replace_me', 'pk_test_dummy_replace_me']);

function isDemoMode() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  return !key || DUMMY_KEY_VALUES.has(key);
}

class PaymentService {
  /** Creates a pending Payment row with a server-generated reference the client
   *  will pass into Paystack Inline — verify() only ever trusts a reference
   *  this service itself issued. In demo mode, `publicKey` is omitted so the
   *  frontend shows its own mock card form instead of Paystack's real popup
   *  (which would reject a dummy key immediately, before any card details). */
  async initializePayment(userId) {
    const reference = `shana_${crypto.randomUUID()}`;
    await Payment.create({
      userId,
      reference,
      amountPesewas: COURSE_ACCESS_AMOUNT_PESEWAS,
      currency: 'GHS',
      channel: 'card',
      status: 'pending',
    });

    return {
      reference,
      amountPesewas: COURSE_ACCESS_AMOUNT_PESEWAS,
      publicKey: isDemoMode() ? undefined : process.env.PAYSTACK_PUBLIC_KEY,
    };
  }

  /**
   * Starts a mobile money charge (MTN / Telecel / AirtelTigo) for a Ghanaian
   * phone number. Unlike card checkout, this doesn't go through Paystack
   * Inline — the backend talks to Paystack's Charge API directly and the
   * response tells the frontend what to show next:
   *  - 'success': already done (rare, but possible; always true in demo mode).
   *  - 'send_otp': the frontend must collect a one-time code and call
   *    submitMobileMoneyOtp() with it.
   *  - 'pay_offline': the customer approves a prompt on their own phone —
   *    the frontend polls verifyAndRecordPayment() (the same /verify
   *    endpoint card checkout uses) until it resolves.
   */
  async initiateMobileMoneyCharge(userId, email, { phone, provider }) {
    if (!MOBILE_MONEY_PROVIDERS.includes(provider)) {
      throw Object.assign(new Error('Unsupported mobile money provider'), { status: 400 });
    }
    if (!phone || typeof phone !== 'string' || !/^[0-9+]{9,15}$/.test(phone.trim())) {
      throw Object.assign(new Error('Enter a valid phone number'), { status: 400 });
    }

    const reference = `shana_${crypto.randomUUID()}`;
    const payment = await Payment.create({
      userId,
      reference,
      amountPesewas: COURSE_ACCESS_AMOUNT_PESEWAS,
      currency: 'GHS',
      channel: 'mobile_money',
      provider,
      status: 'pending',
    });

    // TEMPORARY DEMO BYPASS: the phone number was still genuinely collected
    // above — this only replaces the real Paystack Charge API call once the
    // customer has "sent the request", not the whole flow. Remove once real
    // Paystack keys replace the dummy placeholder values.
    if (isDemoMode()) {
      await this._markSuccess(payment);
      return { reference, status: 'success', hasPaid: true, demo: true };
    }

    const data = await paystackClient.initiateMobileMoneyCharge({
      email,
      amountPesewas: COURSE_ACCESS_AMOUNT_PESEWAS,
      reference,
      phone: phone.trim(),
      provider,
    });

    if (data.status === 'success') {
      await this._markSuccess(payment);
      return { reference, status: 'success', hasPaid: true };
    }
    if (data.status === 'send_otp') {
      return { reference, status: 'send_otp', displayText: data.display_text ?? 'Enter the one-time code sent to your phone.' };
    }
    if (data.status === 'pay_offline') {
      return { reference, status: 'pay_offline', displayText: data.display_text ?? 'Approve the payment prompt on your phone.' };
    }

    await payment.update({ status: 'failed' });
    throw Object.assign(new Error(data.gateway_response || 'Could not start the mobile money payment'), { status: 422 });
  }

  /** Submits the one-time code for a charge that came back `send_otp`. */
  async submitMobileMoneyOtp(reference, otp, { expectedUserId } = {}) {
    const payment = await Payment.findOne({ where: { reference } });
    if (!payment) {
      throw Object.assign(new Error('Payment not found'), { status: 404 });
    }
    if (expectedUserId && payment.userId !== expectedUserId) {
      throw Object.assign(new Error('Forbidden'), { status: 403 });
    }
    if (payment.status === 'success') {
      return { hasPaid: true };
    }
    if (!otp || typeof otp !== 'string') {
      throw Object.assign(new Error('otp is required'), { status: 400 });
    }

    const data = await paystackClient.submitOtp({ otp, reference });

    if (data.status === 'success') {
      await this._markSuccess(payment);
      return { hasPaid: true };
    }

    throw Object.assign(new Error(data.gateway_response || 'That code did not work — please try again'), { status: 422 });
  }

  /**
   * The shared, idempotent core for card checkout's two verification paths
   * (immediate client callback and the webhook backstop): looks up the
   * Payment by reference, calls Paystack to confirm it really succeeded, and
   * — only then — flips the student's entitlement. Safe to call twice for
   * the same reference; the second call is a no-op once the first succeeds.
   * Also what a mobile money `pay_offline` charge is polled against, since
   * Paystack's transaction-verify endpoint covers Charge API transactions
   * the same way it covers Inline ones. Also what the frontend's mock card
   * form calls once the customer "submits" their (fake) card details.
   *
   * `expectedUserId`, when given (the client-verify path), enforces that a
   * student can only verify their own payment. The webhook path omits it —
   * it's trusted via signature, not a JWT, and has no "current user".
   */
  async verifyAndRecordPayment(reference, { expectedUserId } = {}) {
    const payment = await Payment.findOne({ where: { reference } });
    if (!payment) {
      throw Object.assign(new Error('Payment not found'), { status: 404 });
    }
    if (expectedUserId && payment.userId !== expectedUserId) {
      throw Object.assign(new Error('Forbidden'), { status: 403 });
    }
    if (payment.status === 'success') {
      return { hasPaid: true };
    }

    // TEMPORARY DEMO BYPASS: see isDemoMode() above. Auto-succeed instead of
    // calling Paystack, so the rest of the (real) flow — entitlement, trainer
    // assignment — can be demoed end-to-end with the real placeholder UI still shown.
    if (isDemoMode()) {
      await this._markSuccess(payment);
      return { hasPaid: true, demo: true };
    }

    const data = await paystackClient.verifyTransaction(reference);
    const succeeded = data.status === 'success' && data.amount === payment.amountPesewas;

    if (succeeded) {
      await this._markSuccess(payment);
      return { hasPaid: true };
    }

    await payment.update({ status: 'failed', paidAt: null });
    throw Object.assign(new Error('Payment could not be verified'), { status: 422 });
  }

  /** Records a payment as successful and grants entitlement, atomically. */
  async _markSuccess(payment) {
    const transaction = await sequelize.transaction();
    try {
      await payment.update({ status: 'success', paidAt: new Date() }, { transaction });
      await User.update({ hasPaid: true }, { where: { id: payment.userId }, transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

module.exports = new PaymentService();
