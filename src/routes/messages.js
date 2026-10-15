const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const messageService = require('../services/messageService');

router.use(authenticate);

router.get('/conversations', async (req, res, next) => {
  try {
    res.json(await messageService.listConversations(req.user));
  } catch (err) {
    next(err);
  }
});

router.get('/:withUserId', async (req, res, next) => {
  try {
    res.json(await messageService.getConversation(req.user, req.params.withUserId, { after: req.query.after }));
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const message = await messageService.sendMessage(req.user, req.body);
    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
});

router.patch('/:withUserId/read', async (req, res, next) => {
  try {
    await messageService.markRead(req.user, req.params.withUserId);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
