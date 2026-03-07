const router = require('express').Router();
const { User, Enrollment, Module, StudentLesson, Lesson } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const progressService = require('../services/progressService');

router.get('/', authenticate, authorize('instructor', 'admin'), async (req, res, next) => {
  try {
    const students = await User.findAll({
      where: { role: 'student' },
      attributes: ['id', 'firstName', 'lastName', 'email', 'profileImage', 'stars', 'badges', 'trophies', 'modulesCompleted'],
    });
    res.json(students);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const student = await User.findOne({
      where: { id: req.params.id, role: 'student' },
      attributes: ['id', 'firstName', 'lastName', 'email', 'profileImage', 'stars', 'badges', 'trophies', 'modulesCompleted'],
    });
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }
    res.json(student);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const student = await User.findOne({
      where: { id: req.params.id, role: 'student' },
    });
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const allowed = ['firstName', 'lastName', 'email', 'profileImage'];
    const updates = {};
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    await student.update(updates);
    res.json({
      id: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      email: student.email,
      profileImage: student.profileImage,
      stars: student.stars,
      badges: student.badges,
      trophies: student.trophies,
      modulesCompleted: student.modulesCompleted,
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const student = await User.findOne({
      where: { id: req.params.id, role: 'student' },
    });
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }
    await student.destroy();
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// Student modules (enrollments)
router.get('/:id/modules', authenticate, async (req, res, next) => {
  try {
    const enrollments = await Enrollment.findAll({
      where: { userId: req.params.id },
      include: [{
        model: Module,
        attributes: ['id', 'title', 'description', 'icon', 'thumbnail', 'totalLessons', 'totalStars', 'totalBadges', 'totalTrophies'],
      }],
      order: [['enrolledAt', 'DESC']],
    });
    res.json(enrollments);
  } catch (err) {
    next(err);
  }
});

// Student lessons for a module
router.get('/:id/lessons', authenticate, async (req, res, next) => {
  try {
    const { moduleId } = req.query;
    const where = { userId: req.params.id };

    let lessonIds;
    if (moduleId) {
      const lessons = await Lesson.findAll({
        where: { moduleId },
        attributes: ['id'],
      });
      lessonIds = lessons.map((l) => l.id);
      where.lessonId = lessonIds;
    }

    const studentLessons = await StudentLesson.findAll({
      where,
      include: [{
        model: Lesson,
        attributes: ['id', 'title', 'order', 'weekNumber', 'moduleId', 'totalStars', 'totalBadges', 'totalTrophies'],
      }],
      order: [[Lesson, 'order', 'ASC']],
    });
    res.json(studentLessons);
  } catch (err) {
    next(err);
  }
});

// Update student lesson progress
router.put('/:studentId/lessons/:lessonId', authenticate, async (req, res, next) => {
  try {
    const { progress, starsEarned, badgesEarned, trophiesEarned } = req.body;

    if (progress === undefined) {
      return res.status(400).json({ message: 'progress field is required' });
    }
    if (progress < 0 || progress > 100) {
      return res.status(400).json({ message: 'progress must be between 0 and 100' });
    }

    const result = await progressService.updateLessonProgress(
      req.params.studentId,
      req.params.lessonId,
      {
        progress,
        starsEarned: starsEarned || 0,
        badgesEarned: badgesEarned || 0,
        trophiesEarned: trophiesEarned || 0,
      }
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Progress summary
router.get('/:id/progress/summary', authenticate, async (req, res, next) => {
  try {
    const summary = await progressService.getProgressSummary(req.params.id);
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

// Student stats
router.get('/:id/stats', authenticate, async (req, res, next) => {
  try {
    const student = await User.findOne({
      where: { id: req.params.id, role: 'student' },
      attributes: ['id', 'stars', 'badges', 'trophies', 'modulesCompleted'],
    });
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const enrollments = await Enrollment.findAll({
      where: { userId: req.params.id },
    });

    res.json({
      ...student.toJSON(),
      totalAssigned: enrollments.length,
      totalCompleted: enrollments.filter((e) => e.status === 'completed').length,
      totalInProgress: enrollments.filter((e) => e.status === 'unlocked').length,
      totalLocked: enrollments.filter((e) => e.status === 'locked').length,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
