const router = require('express').Router();
const { User } = require('../models');
const { authenticate } = require('../middleware/auth');
const { toUserResponse, AVATAR_IDS } = require('../utils/userResponse');

// A profile photo is a data URL; cap it so one upload can't bloat every user fetch.
const MAX_AVATAR_URL_LENGTH = 2 * 1024 * 1024;

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(toUserResponse(user));
  } catch (err) {
    next(err);
  }
});

router.put('/me', authenticate, async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const { hasSeenWelcome, avatarId, avatarUrl } = req.body;
    if (hasSeenWelcome !== undefined && typeof hasSeenWelcome !== 'boolean') {
      return res.status(400).json({ message: 'hasSeenWelcome must be true or false' });
    }
    if (avatarId !== undefined && avatarId !== null && !AVATAR_IDS.includes(avatarId)) {
      return res.status(400).json({ message: 'Invalid avatarId' });
    }
    if (avatarUrl !== undefined && avatarUrl !== null
      && (typeof avatarUrl !== 'string' || !avatarUrl.startsWith('data:image/') || avatarUrl.length > MAX_AVATAR_URL_LENGTH)) {
      return res.status(400).json({ message: 'avatarUrl must be an image data URL under 2 MB' });
    }

    const updates = {};
    if (req.body.firstName !== undefined) updates.firstName = req.body.firstName;
    if (req.body.lastName !== undefined) updates.lastName = req.body.lastName;
    if (req.body.email !== undefined) updates.email = req.body.email;
    if (req.body.profileImage !== undefined) updates.profileImage = req.body.profileImage || null;
    if (hasSeenWelcome !== undefined) updates.hasSeenWelcome = hasSeenWelcome;
    if (avatarId !== undefined) updates.avatarId = avatarId;
    if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
    await user.update(updates);
    res.json(toUserResponse(user));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
