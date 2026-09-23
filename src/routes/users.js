const router = require('express').Router();
const { User } = require('../models');
const { authenticate } = require('../middleware/auth');

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'firstName', 'lastName', 'email', 'profileImage', 'role', 'stars', 'badges', 'trophies', 'modulesCompleted', 'hasPaid'],
    });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      profileImage: user.profileImage ?? null,
      role: user.role,
      stars: user.stars,
      badges: user.badges,
      trophies: user.trophies,
      modulesCompleted: user.modulesCompleted,
      hasPaid: user.hasPaid,
    });
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
    const updates = {};
    if (req.body.firstName !== undefined) updates.firstName = req.body.firstName;
    if (req.body.lastName !== undefined) updates.lastName = req.body.lastName;
    if (req.body.email !== undefined) updates.email = req.body.email;
    if (req.body.profileImage !== undefined) updates.profileImage = req.body.profileImage || null;
    await user.update(updates);
    res.json({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      profileImage: user.profileImage ?? null,
      role: user.role,
      stars: user.stars,
      badges: user.badges,
      trophies: user.trophies,
      modulesCompleted: user.modulesCompleted,
      hasPaid: user.hasPaid,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
