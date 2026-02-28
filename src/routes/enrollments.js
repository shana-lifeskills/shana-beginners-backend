const router = require('express').Router();
const { Enrollment, Course, User } = require('../models');
const { authenticate } = require('../middleware/auth');

// List current user's enrollments
router.get('/', authenticate, async (req, res, next) => {
  try {
    const enrollments = await Enrollment.findAll({
      where: { userId: req.user.id },
      include: [{ model: Course, attributes: ['id', 'title', 'thumbnail', 'difficulty'] }],
      order: [['enrolledAt', 'DESC']],
    });
    res.json(enrollments);
  } catch (err) {
    next(err);
  }
});

// Get one enrollment by id (must belong to current user)
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const enrollment = await Enrollment.findOne({
      where: { id: req.params.id, userId: req.user.id },
      include: [
        { model: Course, include: [{ model: User, as: 'instructor', attributes: ['id', 'name'] }] },
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

// Update enrollment (e.g. progress)
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

// Unenroll (delete enrollment)
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
