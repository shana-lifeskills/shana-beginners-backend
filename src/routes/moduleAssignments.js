const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const studentProgressService = require('../services/studentProgressService');

const PRIVILEGED_ROLES = ['instructor', 'admin'];

router.use(authenticate);

router.post('/', authorize(...PRIVILEGED_ROLES), async (req, res, next) => {
  try {
    const { moduleId, studentIds } = req.body;
    const result = await studentProgressService.assignModule(moduleId, studentIds, req.user.id);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/batch', authorize(...PRIVILEGED_ROLES), async (req, res, next) => {
  try {
    const { studentIds } = req.query;
    if (!studentIds) {
      return res.status(400).json({ message: 'studentIds is required' });
    }
    const ids = String(studentIds).split(',').map((s) => s.trim()).filter(Boolean);
    res.json(await studentProgressService.getAssignedModuleIdsBatch(ids));
  } catch (err) {
    next(err);
  }
});

router.get('/:studentId', async (req, res, next) => {
  try {
    const { studentId } = req.params;
    if (studentId !== req.user.id && !PRIVILEGED_ROLES.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const moduleIds = await studentProgressService.getAssignedModuleIds(studentId);
    res.json({ studentId, moduleIds });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
