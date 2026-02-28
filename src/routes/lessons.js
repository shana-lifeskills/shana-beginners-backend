const router = require('express').Router();
const { Lesson, Course } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/:courseId/lessons', async (req, res, next) => {
  try {
    const lessons = await Lesson.findAll({
      where: { courseId: req.params.courseId },
      order: [['order', 'ASC']],
    });
    res.json(lessons);
  } catch (err) {
    next(err);
  }
});

router.get('/:courseId/lessons/:id', async (req, res, next) => {
  try {
    const lesson = await Lesson.findOne({
      where: {
        id: req.params.id,
        courseId: req.params.courseId,
      },
    });
    if (!lesson) {
      return res.status(404).json({ message: 'Lesson not found' });
    }
    res.json(lesson);
  } catch (err) {
    next(err);
  }
});

router.post('/:courseId/lessons', authenticate, authorize('instructor', 'admin'), async (req, res, next) => {
  try {
    const course = await Course.findByPk(req.params.courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }
    const lesson = await Lesson.create({
      ...req.body,
      courseId: req.params.courseId,
    });
    res.status(201).json(lesson);
  } catch (err) {
    next(err);
  }
});

router.put('/:courseId/lessons/:id', authenticate, authorize('instructor', 'admin'), async (req, res, next) => {
  try {
    const lesson = await Lesson.findOne({
      where: {
        id: req.params.id,
        courseId: req.params.courseId,
      },
    });
    if (!lesson) {
      return res.status(404).json({ message: 'Lesson not found' });
    }
    await lesson.update(req.body);
    res.json(lesson);
  } catch (err) {
    next(err);
  }
});

router.delete('/:courseId/lessons/:id', authenticate, authorize('instructor', 'admin'), async (req, res, next) => {
  try {
    const lesson = await Lesson.findOne({
      where: {
        id: req.params.id,
        courseId: req.params.courseId,
      },
    });
    if (!lesson) {
      return res.status(404).json({ message: 'Lesson not found' });
    }
    await lesson.destroy();
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
