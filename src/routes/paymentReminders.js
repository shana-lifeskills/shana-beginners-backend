const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const paymentReminderService = require('../services/paymentReminderService');

const PRIVILEGED_ROLES = ['instructor', 'admin'];

/**
 * Manually fires the same month-end payment-reminder check the daily cron
 * (see server.js) runs on its own — lets an admin/trainer trigger it on
 * demand (e.g. to verify the flow, or nudge again without waiting for the
 * scheduled run) instead of only ever running unattended.
 */
router.post('/run', authenticate, authorize(...PRIVILEGED_ROLES), async (req, res, next) => {
  try {
    const result = await paymentReminderService.sendMonthEndPaymentReminders();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
