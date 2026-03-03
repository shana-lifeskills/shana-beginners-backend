const router = require('express').Router();
const { Course, User, Lesson } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', async (req, res, next) => {
  try {
    const { published } = req.query;
    const where = {};
    if (published !== undefined) {
      where.published = published === 'true';
    }
    const courses = await Course.findAll({
      where,
      include: [{ model: User, as: 'instructor', attributes: ['id', 'firstName', 'lastName'] }],
    });
    res.json(courses);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const course = await Course.findByPk(req.params.id, {
      include: [
        { model: User, as: 'instructor', attributes: ['id', 'firstName', 'lastName'] },
        { model: Lesson, order: [['order', 'ASC']] },
      ],
    });
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }
    res.json(course);
  } catch (err) {
    next(err);
  }
});

router.post('/', authenticate, authorize('instructor', 'admin'), async (req, res, next) => {
  try {
    const course = await Course.create({
      ...req.body,
      instructorId: req.user.id,
    });
    res.status(201).json(course);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', authenticate, authorize('instructor', 'admin'), async (req, res, next) => {
  try {
    const course = await Course.findByPk(req.params.id);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }
    await course.update(req.body);
    res.json(course);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const course = await Course.findByPk(req.params.id);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }
    await course.destroy();
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.post('/:id/enroll', authenticate, async (req, res, next) => {
  try {
    const course = await Course.findByPk(req.params.id);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }
    await course.addStudent(req.user.id);
    res.json({ message: 'Enrolled successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
