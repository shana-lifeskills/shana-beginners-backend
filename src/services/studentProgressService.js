const { Op } = require('sequelize');
const {
  sequelize,
  StudentModuleProgress,
  StudentSubmission,
  StarLog,
  BadgeLog,
  TrophyLog,
  ModuleAssignment,
} = require('../models');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Server-side counterpart to the frontend's ProgressService/GamificationService, for the
 * real (frontend-owned, string-id) curriculum — not the unused UUID Module/Lesson system.
 *
 * Curriculum order/structure (which exercise is next, when a lesson/module is "done") is
 * computed client-side, since that shape lives only in the frontend's static content. This
 * service's job is exclusively idempotent bookkeeping of the client-computed outcome, plus
 * idempotent gamification awarding — it does no curriculum-shape reasoning of its own.
 */
class StudentProgressService {
  /** Fetch-or-create a student's progress row for a module, optionally self-healing a
   *  null currentLessonId/currentExerciseId (e.g. content was edited after the student
   *  started with nothing to resume into). */
  async startOrResumeModule(userId, moduleId, { resumeLessonId, resumeExerciseId }) {
    const [progress, created] = await StudentModuleProgress.findOrCreate({
      where: { userId, moduleId },
      defaults: {
        status: 'in-progress',
        currentLessonId: resumeLessonId ?? null,
        currentExerciseId: resumeExerciseId ?? null,
        startedAt: new Date(),
      },
    });

    if (!created && !progress.currentLessonId && resumeLessonId) {
      await progress.update({
        currentLessonId: resumeLessonId,
        currentExerciseId: resumeExerciseId ?? null,
      });
    }

    return progress;
  }

  async getModuleProgress(userId, moduleId) {
    if (!UUID_RE.test(userId)) return null;
    return StudentModuleProgress.findOne({ where: { userId, moduleId } });
  }

  async listProgressForStudent(userId) {
    if (!UUID_RE.test(userId)) return [];
    return StudentModuleProgress.findAll({ where: { userId } });
  }

  /**
   * Records the outcome of one completed step, exactly as computed client-side by
   * ProgressService.advance(): persists the next progress state, and idempotently awards
   * a star (always), a badge (if lessonCompleted) and a trophy (if moduleCompleted).
   * Also idempotently upserts a submission if the step carried free-text values.
   */
  async completeStep(userId, moduleId, exerciseId, {
    lessonId,
    lessonCompleted,
    moduleCompleted,
    completedExerciseIds,
    completedLessonIds,
    currentLessonId,
    currentExerciseId,
    submissionValues,
    studentName,
  }) {
    if (!lessonId) {
      throw Object.assign(new Error('lessonId is required'), { status: 400 });
    }

    const transaction = await sequelize.transaction();
    try {
      const now = new Date();
      const status = moduleCompleted ? 'completed' : 'in-progress';

      const [progress] = await StudentModuleProgress.findOrCreate({
        where: { userId, moduleId },
        defaults: {
          status,
          completedExerciseIds: completedExerciseIds ?? [],
          completedLessonIds: completedLessonIds ?? [],
          currentLessonId: currentLessonId ?? null,
          currentExerciseId: currentExerciseId ?? null,
          startedAt: now,
          completedAt: moduleCompleted ? now : null,
        },
        transaction,
      });

      await progress.update({
        status,
        completedExerciseIds: completedExerciseIds ?? progress.completedExerciseIds,
        completedLessonIds: completedLessonIds ?? progress.completedLessonIds,
        currentLessonId: currentLessonId ?? null,
        currentExerciseId: currentExerciseId ?? null,
        completedAt: moduleCompleted ? (progress.completedAt ?? now) : progress.completedAt,
      }, { transaction });

      const starAwarded = await this._awardStar(userId, moduleId, exerciseId, transaction);

      let badgeAwarded = false;
      if (lessonCompleted) {
        badgeAwarded = await this._awardBadge(userId, moduleId, lessonId, transaction);
      }

      let trophyAwarded = false;
      if (moduleCompleted) {
        trophyAwarded = await this._awardTrophy(userId, moduleId, transaction);
      }

      if (submissionValues) {
        await this._upsertSubmission(
          userId,
          studentName ?? '',
          moduleId,
          lessonId,
          exerciseId,
          submissionValues,
          transaction
        );
      }

      await transaction.commit();
      return { progress: await progress.reload(), lessonCompleted: !!lessonCompleted, moduleCompleted: !!moduleCompleted, starAwarded, badgeAwarded, trophyAwarded };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  // --- Standalone gamification (used e.g. by story-tabs sub-questions) ---

  async awardStar(userId, moduleId, exerciseId) {
    const awarded = await this._awardStar(userId, moduleId, exerciseId);
    return { awarded };
  }

  async _awardStar(userId, moduleId, exerciseId, transaction) {
    try {
      const [, created] = await StarLog.findOrCreate({
        where: { userId, exerciseId },
        defaults: { moduleId, earnedAt: new Date() },
        transaction,
      });
      return created;
    } catch (error) {
      if (error.name === 'SequelizeUniqueConstraintError') return false;
      throw error;
    }
  }

  async _awardBadge(userId, moduleId, lessonId, transaction) {
    try {
      const [, created] = await BadgeLog.findOrCreate({
        where: { userId, lessonId },
        defaults: { moduleId, earnedAt: new Date() },
        transaction,
      });
      return created;
    } catch (error) {
      if (error.name === 'SequelizeUniqueConstraintError') return false;
      throw error;
    }
  }

  async _awardTrophy(userId, moduleId, transaction) {
    try {
      const [, created] = await TrophyLog.findOrCreate({
        where: { userId, moduleId },
        defaults: { earnedAt: new Date() },
        transaction,
      });
      return created;
    } catch (error) {
      if (error.name === 'SequelizeUniqueConstraintError') return false;
      throw error;
    }
  }

  async getRewardTotals(userId) {
    if (!UUID_RE.test(userId)) return { stars: 0, badges: 0, trophies: 0 };
    const [stars, badges, trophies] = await Promise.all([
      StarLog.count({ where: { userId } }),
      BadgeLog.count({ where: { userId } }),
      TrophyLog.count({ where: { userId } }),
    ]);
    return { stars, badges, trophies };
  }

  /** Sums stars/badges/trophies across every student — powers the trainer
   *  dashboard's stat cards, reusing the same log tables real per-student
   *  totals already come from. */
  async getRewardTotalsAcrossAllStudents() {
    const [stars, badges, trophies] = await Promise.all([
      StarLog.count(),
      BadgeLog.count(),
      TrophyLog.count(),
    ]);
    return { stars, badges, trophies };
  }

  async getRewardDetails(userId) {
    if (!UUID_RE.test(userId)) return { totals: { stars: 0, badges: 0, trophies: 0 }, badges: [], trophies: [] };
    const [totals, badges, trophies] = await Promise.all([
      this.getRewardTotals(userId),
      BadgeLog.findAll({ where: { userId }, order: [['earnedAt', 'DESC']] }),
      TrophyLog.findAll({ where: { userId }, order: [['earnedAt', 'DESC']] }),
    ]);
    return {
      totals,
      badges: badges.map((b) => ({ moduleId: b.moduleId, lessonId: b.lessonId, earnedAt: b.earnedAt })),
      trophies: trophies.map((t) => ({ moduleId: t.moduleId, earnedAt: t.earnedAt })),
    };
  }

  async getStarsThisWeek(userId) {
    if (!UUID_RE.test(userId)) return { starsThisWeek: 0 };
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const starsThisWeek = await StarLog.count({ where: { userId, earnedAt: { [Op.gte]: since } } });
    return { starsThisWeek };
  }

  // --- Submissions ---

  async _upsertSubmission(userId, studentName, moduleId, lessonId, exerciseId, values, transaction) {
    const [submission, created] = await StudentSubmission.findOrCreate({
      where: { userId, exerciseId },
      defaults: { studentName, moduleId, lessonId, values, submittedAt: new Date() },
      transaction,
    });
    if (!created) {
      await submission.update({ studentName, values, submittedAt: new Date() }, { transaction });
    }
    return submission;
  }

  /**
   * Submissions for share-prompt exercises are visible to every student, not just their
   * author — the frontend uses this to show a "what other students said" board — so this
   * is intentionally not scoped to one userId, unlike every other read in this service.
   */
  async listSubmissionsForExercise(exerciseId) {
    return StudentSubmission.findAll({ where: { exerciseId }, order: [['submittedAt', 'ASC']] });
  }

  // --- Assignments ---

  async assignModule(moduleId, studentIds, assignedByUserId) {
    if (!moduleId || typeof moduleId !== 'string') {
      throw Object.assign(new Error('moduleId is required'), { status: 400 });
    }
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      throw Object.assign(new Error('studentIds must be a non-empty array'), { status: 400 });
    }

    // Silently skip any id that isn't a real backend user (e.g. a locally-seeded demo
    // account mixed into the student list) rather than let one bad id 500 the whole batch.
    const validStudentIds = studentIds.filter((id) => UUID_RE.test(id));

    const transaction = await sequelize.transaction();
    try {
      let assigned = 0;
      for (const userId of validStudentIds) {
        const [, created] = await ModuleAssignment.findOrCreate({
          where: { userId, moduleId },
          defaults: { assignedByUserId: assignedByUserId ?? null, assignedAt: new Date() },
          transaction,
        });
        if (created) assigned += 1;
      }
      await transaction.commit();
      return { assigned };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async getAssignedModuleIds(userId) {
    if (!UUID_RE.test(userId)) return [];
    const rows = await ModuleAssignment.findAll({ where: { userId } });
    return rows.map((r) => r.moduleId);
  }

  async getAssignedModuleIdsBatch(userIds) {
    const result = {};
    userIds.forEach((id) => { result[id] = []; });

    // Ids that aren't valid UUIDs (e.g. a caller passing through locally-seeded demo
    // account ids) can never match a real userId — skip them rather than let Postgres
    // reject the whole query with an "invalid input syntax for type uuid" error.
    const validIds = userIds.filter((id) => UUID_RE.test(id));
    if (validIds.length === 0) return result;

    const rows = await ModuleAssignment.findAll({ where: { userId: validIds } });
    rows.forEach((r) => { result[r.userId].push(r.moduleId); });
    return result;
  }
}

module.exports = new StudentProgressService();
