const { sequelize, Enrollment, StudentLesson, Lesson, Module, User } = require('../models');

class ProgressService {
  /**
   * Update a student's lesson progress and recalculate module progress.
   * Enforces sequential lesson unlocking and achievement caps.
   */
  async updateLessonProgress(userId, lessonId, progressData) {
    const transaction = await sequelize.transaction();

    try {
      const lesson = await Lesson.findByPk(lessonId, { transaction });
      if (!lesson) {
        throw Object.assign(new Error('Lesson not found'), { status: 404 });
      }

      if (progressData.starsEarned > lesson.totalStars) {
        throw Object.assign(
          new Error(`starsEarned cannot exceed ${lesson.totalStars}`),
          { status: 400 }
        );
      }
      if (progressData.badgesEarned > lesson.totalBadges) {
        throw Object.assign(
          new Error(`badgesEarned cannot exceed ${lesson.totalBadges}`),
          { status: 400 }
        );
      }
      if (progressData.trophiesEarned > lesson.totalTrophies) {
        throw Object.assign(
          new Error(`trophiesEarned cannot exceed ${lesson.totalTrophies}`),
          { status: 400 }
        );
      }

      // Sequential unlocking: check if previous lesson is completed
      if (lesson.order > 0) {
        const previousLesson = await Lesson.findOne({
          where: { moduleId: lesson.moduleId, order: lesson.order - 1 },
          transaction,
        });

        if (previousLesson) {
          const previousProgress = await StudentLesson.findOne({
            where: { userId, lessonId: previousLesson.id },
            transaction,
          });

          if (!previousProgress || previousProgress.status !== 'completed') {
            throw Object.assign(
              new Error('Previous lesson must be completed first'),
              { status: 422 }
            );
          }
        }
      }

      let status = 'locked';
      if (progressData.progress === 100) {
        status = 'completed';
      } else if (progressData.progress > 0) {
        status = 'in-progress';
      }

      const [studentLesson, created] = await StudentLesson.findOrCreate({
        where: { userId, lessonId },
        defaults: {
          status,
          progress: progressData.progress,
          starsEarned: progressData.starsEarned || 0,
          badgesEarned: progressData.badgesEarned || 0,
          trophiesEarned: progressData.trophiesEarned || 0,
        },
        transaction,
      });

      if (!created) {
        await studentLesson.update({
          status,
          progress: progressData.progress,
          starsEarned: progressData.starsEarned || 0,
          badgesEarned: progressData.badgesEarned || 0,
          trophiesEarned: progressData.trophiesEarned || 0,
        }, { transaction });
      }

      await this.recalculateModuleProgress(userId, lesson.moduleId, transaction);

      await transaction.commit();
      return studentLesson.reload();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Recalculate module enrollment progress from completed lessons.
   */
  async recalculateModuleProgress(userId, moduleId, transaction) {
    const allLessons = await Lesson.findAll({
      where: { moduleId },
      transaction,
    });

    if (allLessons.length === 0) return null;

    const completedLessons = await StudentLesson.findAll({
      where: {
        userId,
        lessonId: allLessons.map((l) => l.id),
        status: 'completed',
      },
      transaction,
    });

    const completedCount = completedLessons.length;
    const totalCount = allLessons.length;
    const progressPercent = Math.floor((100 * completedCount) / totalCount);

    const totalStars = completedLessons.reduce((sum, sl) => sum + sl.starsEarned, 0);
    const totalBadges = completedLessons.reduce((sum, sl) => sum + sl.badgesEarned, 0);
    const totalTrophies = completedLessons.reduce((sum, sl) => sum + sl.trophiesEarned, 0);

    let status = 'locked';
    if (completedCount === totalCount) {
      status = 'completed';
    } else if (completedCount > 0) {
      status = 'unlocked';
    }

    const enrollment = await Enrollment.findOne({
      where: { userId, moduleId },
      transaction,
    });

    if (!enrollment) return null;

    await enrollment.update({
      progressPercent,
      status,
      starsEarned: totalStars,
      badgesEarned: totalBadges,
      trophiesEarned: totalTrophies,
    }, { transaction });

    if (status === 'completed') {
      await this.recalculateUserTotals(userId, transaction);
    }

    return enrollment;
  }

  /**
   * Recalculate user-level totals from all completed module enrollments.
   */
  async recalculateUserTotals(userId, transaction) {
    const completedEnrollments = await Enrollment.findAll({
      where: { userId, status: 'completed' },
      transaction,
    });

    const stars = completedEnrollments.reduce((sum, e) => sum + e.starsEarned, 0);
    const badges = completedEnrollments.reduce((sum, e) => sum + e.badgesEarned, 0);
    const trophies = completedEnrollments.reduce((sum, e) => sum + e.trophiesEarned, 0);
    const modulesCompleted = completedEnrollments.length;

    await User.update(
      { stars, badges, trophies, modulesCompleted },
      { where: { id: userId }, transaction }
    );
  }

  /**
   * Get a comprehensive progress summary for a student.
   */
  async getProgressSummary(userId) {
    const enrollments = await Enrollment.findAll({
      where: { userId },
      include: [{
        model: Module,
        include: [{
          model: Lesson,
          attributes: ['id', 'title', 'order', 'weekNumber', 'totalStars', 'totalBadges', 'totalTrophies'],
        }],
      }],
      order: [[Module, Lesson, 'order', 'ASC']],
    });

    const modules = await Promise.all(
      enrollments.map(async (enrollment) => {
        const mod = enrollment.Module;
        const lessonIds = mod.Lessons.map((l) => l.id);

        const studentLessons = await StudentLesson.findAll({
          where: { userId, lessonId: lessonIds },
        });

        const lessonProgressMap = {};
        studentLessons.forEach((sl) => {
          lessonProgressMap[sl.lessonId] = sl;
        });

        const lessons = mod.Lessons.map((lesson) => {
          const progress = lessonProgressMap[lesson.id];
          return {
            id: lesson.id,
            title: lesson.title,
            order: lesson.order,
            weekNumber: lesson.weekNumber,
            totalStars: lesson.totalStars,
            totalBadges: lesson.totalBadges,
            totalTrophies: lesson.totalTrophies,
            status: progress ? progress.status : 'locked',
            progress: progress ? progress.progress : 0,
            starsEarned: progress ? progress.starsEarned : 0,
            badgesEarned: progress ? progress.badgesEarned : 0,
            trophiesEarned: progress ? progress.trophiesEarned : 0,
          };
        });

        return {
          id: mod.id,
          title: mod.title,
          description: mod.description,
          icon: mod.icon,
          totalLessons: mod.totalLessons,
          status: enrollment.status,
          progressPercent: enrollment.progressPercent,
          starsEarned: enrollment.starsEarned,
          badgesEarned: enrollment.badgesEarned,
          trophiesEarned: enrollment.trophiesEarned,
          lessons,
        };
      })
    );

    const totalAssigned = enrollments.length;
    const totalCompleted = enrollments.filter((e) => e.status === 'completed').length;
    const totalInProgress = enrollments.filter((e) => e.status === 'unlocked').length;
    const totalLocked = enrollments.filter((e) => e.status === 'locked').length;

    return {
      userId,
      stats: {
        totalAssigned,
        totalCompleted,
        totalInProgress,
        totalLocked,
      },
      modules,
    };
  }
}

module.exports = new ProgressService();
