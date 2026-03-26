const router = require('express').Router();
const { Enrollment, Module, User } = require('../models');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, async (req, res, next) => {
  try {
    const enrollments = await Enrollment.findAll({
      where: { userId: req.user.id },
      include: [{ model: Module, attributes: ['id', 'title', 'thumbnail', 'difficulty', 'icon', 'totalLessons'] }],
      order: [['enrolledAt', 'DESC']],
    });
    res.json(enrollments);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const enrollment = await Enrollment.findOne({
      where: { id: req.params.id, userId: req.user.id },
      include: [
        { model: Module, include: [{ model: User, as: 'instructor', attributes: ['id', 'firstName', 'lastName'] }] },
      ],
    });
    if (!enrollment) {
      return res.status(404).json({ message: 'Enrollment not found' });
    }
    res.json(enrollment);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const enrollment = await Enrollment.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!enrollment) {
      return res.status(404).json({ message: 'Enrollment not found' });
    }
    const { progressPercent } = req.body;
    if (progressPercent !== undefined) {
      await enrollment.update({ progressPercent });
    }
    res.json(enrollment);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const enrollment = await Enrollment.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!enrollment) {
      return res.status(404).json({ message: 'Enrollment not found' });
    }
    await enrollment.destroy();
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
