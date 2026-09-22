const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const studentProgressService = require('../services/studentProgressService');

const PRIVILEGED_ROLES = ['instructor', 'admin'];

/**
 * Resolves which user's data a read route should return: the caller themselves, or —
 * only for an instructor/admin — another student named via ?studentId=. A non-privileged
 * caller asking for someone else's data is rejected.
 */
function resolveTargetUserId(req) {
  const { studentId } = req.query;
  if (!studentId || studentId === req.user.id) return req.user.id;
  if (!PRIVILEGED_ROLES.includes(req.user.role)) {
    throw Object.assign(new Error('Forbidden'), { status: 403 });
  }
  return studentId;
}

router.use(authenticate);

router.post('/:moduleId/start', async (req, res, next) => {
  try {
    const { resumeLessonId, resumeExerciseId } = req.body;
    const progress = await studentProgressService.startOrResumeModule(
      req.user.id,
      req.params.moduleId,
      { resumeLessonId, resumeExerciseId }
    );
    res.json(progress);
  } catch (err) {
    next(err);
  }
});

router.post('/:moduleId/steps/:exerciseId/complete', async (req, res, next) => {
  try {
    const {
      lessonId,
      lessonCompleted,
      moduleCompleted,
      completedExerciseIds,
      completedLessonIds,
      currentLessonId,
      currentExerciseId,
      submissionValues,
      studentName,
    } = req.body;

    const result = await studentProgressService.completeStep(
      req.user.id,
      req.params.moduleId,
      req.params.exerciseId,
      {
        lessonId,
        lessonCompleted,
        moduleCompleted,
        completedExerciseIds,
        completedLessonIds,
        currentLessonId,
        currentExerciseId,
        submissionValues,
        studentName,
      }
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/:moduleId/stars/:exerciseId', async (req, res, next) => {
  try {
    const result = await studentProgressService.awardStar(req.user.id, req.params.moduleId, req.params.exerciseId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Submissions for a share-prompt exercise are visible to every student (this is a
// "what other students said" board), so — unlike every other read below — this is
// intentionally not scoped to the caller via resolveTargetUserId.
router.get('/submissions', async (req, res, next) => {
  try {
    const { exerciseId } = req.query;
    if (!exerciseId) {
      return res.status(400).json({ message: 'exerciseId is required' });
    }
    const submissions = await studentProgressService.listSubmissionsForExercise(exerciseId);
    res.json(submissions);
  } catch (err) {
    next(err);
  }
});

router.get('/rewards/totals', async (req, res, next) => {
  try {
    const userId = resolveTargetUserId(req);
    res.json(await studentProgressService.getRewardTotals(userId));
  } catch (err) {
    next(err);
  }
});

router.get('/rewards/details', async (req, res, next) => {
  try {
    const userId = resolveTargetUserId(req);
    res.json(await studentProgressService.getRewardDetails(userId));
  } catch (err) {
    next(err);
  }
});

router.get('/rewards/stars-this-week', async (req, res, next) => {
  try {
    const userId = resolveTargetUserId(req);
    res.json(await studentProgressService.getStarsThisWeek(userId));
  } catch (err) {
    next(err);
  }
});

router.get('/:moduleId', async (req, res, next) => {
  try {
    const userId = resolveTargetUserId(req);
    const progress = await studentProgressService.getModuleProgress(userId, req.params.moduleId);
    if (!progress) {
      return res.status(404).json({ message: 'No progress recorded for this module' });
    }
    res.json(progress);
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const userId = resolveTargetUserId(req);
    res.json(await studentProgressService.listProgressForStudent(userId));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
