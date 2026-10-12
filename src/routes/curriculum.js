const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const curriculumService = require('../services/curriculumService');

// Content, not student-specific state — any authenticated user (student or
// trainer/admin) can read it, no role restriction.
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    res.json(await curriculumService.list());
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    res.json(await curriculumService.getById(req.params.id));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
