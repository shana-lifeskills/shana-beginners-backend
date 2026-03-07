const router = require('express').Router();
const { Lesson, Module } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/:id', async (req, res, next) => {
  try {
    const lesson = await Lesson.findByPk(req.params.id);
    if (!lesson) {
      return res.status(404).json({ message: 'Lesson not found' });
    }
    res.json(lesson);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', authenticate, authorize('instructor', 'admin'), async (req, res, next) => {
  try {
    const lesson = await Lesson.findByPk(req.params.id);
    if (!lesson) {
      return res.status(404).json({ message: 'Lesson not found' });
    }
    await lesson.update(req.body);

    const lessonCount = await Lesson.count({ where: { moduleId: lesson.moduleId } });
    await Module.update({ totalLessons: lessonCount }, { where: { id: lesson.moduleId } });

    res.json(lesson);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authenticate, authorize('instructor', 'admin'), async (req, res, next) => {
  try {
    const lesson = await Lesson.findByPk(req.params.id);
    if (!lesson) {
      return res.status(404).json({ message: 'Lesson not found' });
    }
    const { moduleId } = lesson;
    await lesson.destroy();

    const lessonCount = await Lesson.count({ where: { moduleId } });
    await Module.update({ totalLessons: lessonCount }, { where: { id: moduleId } });

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
