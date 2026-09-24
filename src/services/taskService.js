const fs = require('fs');
const { Task, TaskSubmission, User } = require('../models');

class TaskService {
  async createTask(createdByUserId, { title, instructions, ageGroup, dueAt }) {
    if (!title || typeof title !== 'string' || !title.trim()) {
      throw Object.assign(new Error('title is required'), { status: 400 });
    }
    if (!['beginner', 'advanced'].includes(ageGroup)) {
      throw Object.assign(new Error('ageGroup must be beginner or advanced'), { status: 400 });
    }
    return Task.create({
      title: title.trim(),
      instructions: instructions && typeof instructions === 'string' ? instructions.trim() : null,
      ageGroup,
      dueAt: dueAt ? new Date(dueAt) : null,
      createdByUserId,
    });
  }

  /** Every trainer/admin sees every task — same shared-catalog precedent as modules. */
  async listTasksForCoach() {
    return Task.findAll({ order: [['createdAt', 'DESC']] });
  }

  async listTasksForStudent(ageGroup) {
    return Task.findAll({ where: { ageGroup }, order: [['createdAt', 'DESC']] });
  }

  async getTask(taskId) {
    return Task.findByPk(taskId);
  }

  /** Creates or overwrites this student's submission for a task — only the
   *  latest file is kept, so a resubmit deletes the old one from disk. */
  async submitTask(taskId, studentId, file) {
    const task = await Task.findByPk(taskId);
    if (!task) {
      throw Object.assign(new Error('Assignment not found'), { status: 404 });
    }

    const existing = await TaskSubmission.findOne({ where: { taskId, studentId } });
    if (existing) {
      fs.unlink(existing.filePath, () => {}); // best-effort cleanup, don't block on it
      await existing.update({
        fileName: file.originalname,
        filePath: file.path,
        fileSize: file.size,
        submittedAt: new Date(),
        status: 'pending',
        reviewedAt: null,
        reviewedByUserId: null,
      });
      return existing;
    }

    return TaskSubmission.create({
      taskId,
      studentId,
      fileName: file.originalname,
      filePath: file.path,
      fileSize: file.size,
      submittedAt: new Date(),
      status: 'pending',
    });
  }

  async markReviewed(submissionId, reviewerId) {
    const submission = await TaskSubmission.findByPk(submissionId);
    if (!submission) {
      throw Object.assign(new Error('Submission not found'), { status: 404 });
    }
    await submission.update({ status: 'reviewed', reviewedAt: new Date(), reviewedByUserId: reviewerId });
    return submission;
  }

  /** All submissions, joined with task title and student name — powers the
   *  "Submitted assignments" review list. */
  async listSubmissionsForCoach() {
    const submissions = await TaskSubmission.findAll({
      include: [
        { model: Task, attributes: ['id', 'title', 'dueAt'] },
        { model: User, as: 'student', attributes: ['id', 'firstName', 'lastName'] },
      ],
      order: [['submittedAt', 'DESC']],
    });

    return submissions.map((s) => ({
      id: s.id,
      taskId: s.taskId,
      taskTitle: s.Task?.title ?? 'Assignment',
      studentId: s.studentId,
      studentName: s.student ? `${s.student.firstName} ${s.student.lastName}` : 'Student',
      fileName: s.fileName,
      fileSize: s.fileSize,
      submittedAt: s.submittedAt,
      status: s.status,
      // 'late' only matters while still pending — once reviewed, the outcome is what matters.
      late: s.status === 'pending' && !!s.Task?.dueAt && new Date(s.submittedAt) > new Date(s.Task.dueAt),
      reviewedAt: s.reviewedAt,
    }));
  }

  async listSubmissionsForStudent(studentId) {
    const submissions = await TaskSubmission.findAll({
      where: { studentId },
      include: [{ model: Task, attributes: ['id', 'title'] }],
      order: [['submittedAt', 'DESC']],
    });
    return submissions.map((s) => ({
      id: s.id,
      taskId: s.taskId,
      taskTitle: s.Task?.title ?? 'Assignment',
      fileName: s.fileName,
      submittedAt: s.submittedAt,
      status: s.status,
    }));
  }

  /** Loads a submission for download, enforcing that only the submitting
   *  student or an instructor/admin can fetch the file. */
  async getSubmissionForDownload(submissionId, requester) {
    const submission = await TaskSubmission.findByPk(submissionId);
    if (!submission) {
      throw Object.assign(new Error('Submission not found'), { status: 404 });
    }
    const isOwner = submission.studentId === requester.id;
    const isStaff = requester.role === 'instructor' || requester.role === 'admin';
    if (!isOwner && !isStaff) {
      throw Object.assign(new Error('Forbidden'), { status: 403 });
    }
    return submission;
  }
}

module.exports = new TaskService();
