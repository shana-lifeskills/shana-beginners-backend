const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const meetingService = require('../services/meetingService');

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    res.json(await meetingService.listMeetings(req.user));
  } catch (err) {
    next(err);
  }
});

router.post('/', authorize('instructor', 'admin'), async (req, res, next) => {
  try {
    const meeting = await meetingService.createMeeting(req.user, req.body);
    res.status(201).json(meeting);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    res.json(await meetingService.getMeeting(req.user, req.params.id));
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authorize('instructor', 'admin'), async (req, res, next) => {
  try {
    res.json(await meetingService.cancelMeeting(req.user, req.params.id));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
