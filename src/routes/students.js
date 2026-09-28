const router = require('express').Router();
const { User, ModuleAssignment } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { toUserResponse } = require('../utils/userResponse');

/** Every student with their assigned module ids — what the Admin and Trainer screens list. */
router.get('/', authenticate, authorize('instructor', 'admin'), async (req, res, next) => {
  try {
    const students = await User.findAll({
      where: { role: 'student' },
      include: [{ model: ModuleAssignment, attributes: ['moduleId', 'assignedAt'] }],
      order: [['firstName', 'ASC'], ['lastName', 'ASC'], [ModuleAssignment, 'assignedAt', 'ASC']],
    });
    res.json(students.map((s) => ({
      ...toUserResponse(s),
      assignedModuleIds: s.ModuleAssignments.map((a) => a.moduleId),
    })));
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

module.exports = router;
