const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const taskService = require('../services/taskService');

const PRIVILEGED_ROLES = ['instructor', 'admin'];

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.doc', '.docx', '.zip', '.jpg', '.jpeg', '.png', '.txt', '.xlsx', '.pptx']);

const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, '../../uploads/tasks'),
    filename: (req, file, cb) => {
      cb(null, `${crypto.randomUUID()}${path.extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_EXTENSIONS.has(path.extname(file.originalname).toLowerCase())) {
      return cb(Object.assign(new Error('Unsupported file type'), { status: 400 }));
    }
    cb(null, true);
  },
});

router.use(authenticate);

router.post('/', authorize(...PRIVILEGED_ROLES), async (req, res, next) => {
  try {
    const { title, instructions, ageGroup, dueAt } = req.body;
    const task = await taskService.createTask(req.user.id, { title, instructions, ageGroup, dueAt });
    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
});

// Students pass their own ageGroup (a client-owned field, same trust model as
// curriculum order elsewhere in this app — ageGroup lives only on the frontend
// today). Staff always get every task regardless of what's passed.
router.get('/', async (req, res, next) => {
  try {
    if (PRIVILEGED_ROLES.includes(req.user.role)) {
      return res.json(await taskService.listTasksForCoach());
    }
    const { ageGroup } = req.query;
    if (!ageGroup || !['beginner', 'advanced'].includes(ageGroup)) {
      return res.status(400).json({ message: 'ageGroup is required' });
    }
    res.json(await taskService.listTasksForStudent(ageGroup));
  } catch (err) {
    next(err);
  }
});

router.get('/submissions', authorize(...PRIVILEGED_ROLES), async (req, res, next) => {
  try {
    res.json(await taskService.listSubmissionsForCoach());
  } catch (err) {
    next(err);
  }
});

router.get('/submissions/mine', async (req, res, next) => {
  try {
    res.json(await taskService.listSubmissionsForStudent(req.user.id));
  } catch (err) {
    next(err);
  }
});

router.get('/submissions/:id/file', async (req, res, next) => {
  try {
    const submission = await taskService.getSubmissionForDownload(req.params.id, req.user);
    res.download(submission.filePath, submission.fileName);
  } catch (err) {
    next(err);
  }
});

router.put('/submissions/:id/review', authorize(...PRIVILEGED_ROLES), async (req, res, next) => {
  try {
    const submission = await taskService.markReviewed(req.params.id, req.user.id);
    res.json(submission);
  } catch (err) {
    next(err);
  }
});

router.post('/:taskId/submissions', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'A file is required' });
    }
    const submission = await taskService.submitTask(req.params.taskId, req.user.id, req.file);
    res.status(201).json(submission);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
