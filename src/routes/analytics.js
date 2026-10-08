const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const analyticsService = require('../services/analyticsService');

// Everything here is aggregate, cross-student data — instructor/admin only.
router.use(authenticate, authorize('instructor', 'admin'));

router.get('/revenue-over-time', async (req, res, next) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 365);
    res.json(await analyticsService.revenueOverTime(days));
  } catch (err) {
    next(err);
  }
});

router.get('/payments-by-module', async (req, res, next) => {
  try {
    res.json(await analyticsService.paymentsByModule());
  } catch (err) {
    next(err);
  }
});

router.get('/payment-status', async (req, res, next) => {
  try {
    res.json(await analyticsService.paymentStatusBreakdown());
  } catch (err) {
    next(err);
  }
});

router.get('/module-completion', async (req, res, next) => {
  try {
    res.json(await analyticsService.moduleCompletion());
  } catch (err) {
    next(err);
  }
});

module.exports = router;
