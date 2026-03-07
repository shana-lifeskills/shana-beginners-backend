const router = require('express').Router();
const { Module, User, Lesson } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', async (req, res, next) => {
  try {
    const { published } = req.query;
    const where = {};
    if (published !== undefined) {
      where.published = published === 'true';
    }
    const modules = await Module.findAll({
      where,
      include: [{ model: User, as: 'instructor', attributes: ['id', 'firstName', 'lastName'] }],
    });
    res.json(modules);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const mod = await Module.findByPk(req.params.id, {
      include: [
        { model: User, as: 'instructor', attributes: ['id', 'firstName', 'lastName'] },
        { model: Lesson, order: [['order', 'ASC']] },
      ],
    });
    if (!mod) {
      return res.status(404).json({ message: 'Module not found' });
    }
    res.json(mod);
  } catch (err) {
    next(err);
  }
});

router.post('/', authenticate, authorize('instructor', 'admin'), async (req, res, next) => {
  try {
    const mod = await Module.create({
      ...req.body,
      instructorId: req.user.id,
    });
    res.status(201).json(mod);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', authenticate, authorize('instructor', 'admin'), async (req, res, next) => {
  try {
    const mod = await Module.findByPk(req.params.id);
    if (!mod) {
      return res.status(404).json({ message: 'Module not found' });
    }
    await mod.update(req.body);
    res.json(mod);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const mod = await Module.findByPk(req.params.id);
    if (!mod) {
      return res.status(404).json({ message: 'Module not found' });
    }
    await mod.destroy();
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.get('/:id/lessons', async (req, res, next) => {
  try {
    const lessons = await Lesson.findAll({
      where: { moduleId: req.params.id },
      order: [['order', 'ASC']],
    });
    res.json(lessons);
  } catch (err) {
    next(err);
  }
});

router.post('/:moduleId/lessons', authenticate, authorize('instructor', 'admin'), async (req, res, next) => {
  try {
    const mod = await Module.findByPk(req.params.moduleId);
    if (!mod) {
      return res.status(404).json({ message: 'Module not found' });
    }
    const lesson = await Lesson.create({
      ...req.body,
      moduleId: req.params.moduleId,
    });

    const lessonCount = await Lesson.count({ where: { moduleId: req.params.moduleId } });
    await mod.update({ totalLessons: lessonCount });

    res.status(201).json(lesson);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/enroll', authenticate, async (req, res, next) => {
  try {
    const mod = await Module.findByPk(req.params.id);
    if (!mod) {
      return res.status(404).json({ message: 'Module not found' });
    }
    await mod.addStudent(req.user.id);
    res.json({ message: 'Enrolled successfully' });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/students', authenticate, authorize('instructor', 'admin'), async (req, res, next) => {
  try {
    const mod = await Module.findByPk(req.params.id, {
      include: [{
        model: User,
        as: 'students',
        attributes: ['id', 'firstName', 'lastName', 'email', 'profileImage'],
        through: { attributes: ['status', 'progressPercent', 'starsEarned', 'badgesEarned', 'trophiesEarned'] },
      }],
    });
    if (!mod) {
      return res.status(404).json({ message: 'Module not found' });
    }
    res.json(mod.students);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
