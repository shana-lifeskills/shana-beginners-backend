const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const paymentService = require('../services/paymentService');
const paystackClient = require('../services/paystackClient');

router.post('/initialize', authenticate, async (req, res, next) => {
  try {
    const result = await paymentService.initializePayment(req.user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/verify', authenticate, async (req, res, next) => {
  try {
    const { reference } = req.body;
    if (!reference || typeof reference !== 'string') {
      return res.status(400).json({ message: 'reference is required' });
    }
    const result = await paymentService.verifyAndRecordPayment(reference, { expectedUserId: req.user.id });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Mobile money (MTN / Telecel / AirtelTigo) — a different Paystack API
// (Charge, not Inline) with its own status flow; see paymentService for details.
router.post('/mobile-money/initiate', authenticate, async (req, res, next) => {
  try {
    const { phone, provider } = req.body;
    const result = await paymentService.initiateMobileMoneyCharge(req.user.id, req.user.email, { phone, provider });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/mobile-money/submit-otp', authenticate, async (req, res, next) => {
  try {
    const { reference, otp } = req.body;
    if (!reference || typeof reference !== 'string') {
      return res.status(400).json({ message: 'reference is required' });
    }
    const result = await paymentService.submitMobileMoneyOtp(reference, otp, { expectedUserId: req.user.id });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Paystack calls this server-to-server — no JWT, trusted only via the signed
// body. Mounted ahead of the global express.json() in server.js so `req.body`
// here is the *raw* Buffer the signature was computed over.
router.post('/webhook', async (req, res, next) => {
  try {
    const signature = req.headers['x-paystack-signature'];
    if (!paystackClient.isValidWebhookSignature(req.body, signature)) {
      return res.status(401).json({ message: 'Invalid signature' });
    }

    const event = JSON.parse(req.body.toString('utf8'));
    if (event.event === 'charge.success' && event.data?.reference) {
      // A genuinely failed/mismatched verification isn't something a Paystack
      // retry would fix — acknowledge receipt either way so it doesn't keep
      // resending; only a truly unexpected error surfaces to the handler below.
      try {
        await paymentService.verifyAndRecordPayment(event.data.reference, {});
      } catch (err) {
        console.error('Webhook verification failed:', err.message);
      }
    }
    res.status(200).json({ received: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
