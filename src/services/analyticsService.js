const { Op, fn, col, literal } = require('sequelize');
const { sequelize, Payment, User, StudentModuleProgress, CurriculumModule } = require('../models');

const TOP_N = 10;

/** YYYY-MM-DD for a Date, in UTC — matches how Postgres's DATE() truncates `paidAt`. */
function dateKey(d) {
  return d.toISOString().slice(0, 10);
}

/** Beginner and advanced modules can share the exact same title (e.g. both
 *  tiers have a "Self-Confidence" module) — always append the tier so an
 *  admin chart never shows two identical-looking bars with no way to tell
 *  them apart. */
function moduleLabel(title, ageGroup) {
  const tier = ageGroup === 'advanced' ? 'Advanced' : 'Beginner';
  return `${title} (${tier})`;
}

class AnalyticsService {
  /**
   * Revenue per calendar day for the trailing `days` days (today inclusive),
   * zero-filled so a day with no payments still appears instead of leaving a
   * gap in the line — a chart reading "no data" and "zero revenue" the same
   * way would be misleading.
   */
  async revenueOverTime(days = 30) {
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - (days - 1));

    const rows = await Payment.findAll({
      where: { status: 'success', paidAt: { [Op.gte]: since } },
      attributes: [[fn('DATE', col('paidAt')), 'date'], [fn('SUM', col('amountPesewas')), 'revenuePesewas']],
      group: [fn('DATE', col('paidAt'))],
      raw: true,
    });
    const revenueByDate = new Map(rows.map((r) => [r.date, parseInt(r.revenuePesewas, 10)]));

    const series = [];
    for (let i = 0; i < days; i += 1) {
      const d = new Date(since);
      d.setUTCDate(d.getUTCDate() + i);
      const key = dateKey(d);
      series.push({ date: key, revenuePesewas: revenueByDate.get(key) ?? 0 });
    }

    return { days: series, totalRevenuePesewas: series.reduce((sum, d) => sum + d.revenuePesewas, 0) };
  }

  /** Top modules by revenue — which modules actually sell. Games never appear
   *  here (they're never paid for), so no category filter is needed. */
  async paymentsByModule() {
    const rows = await Payment.findAll({
      where: { status: 'success', moduleId: { [Op.ne]: null } },
      attributes: ['moduleId', [fn('COUNT', col('id')), 'successCount'], [fn('SUM', col('amountPesewas')), 'revenuePesewas']],
      group: ['moduleId'],
      order: [[fn('SUM', col('amountPesewas')), 'DESC']],
      limit: TOP_N,
      raw: true,
    });

    const moduleIds = rows.map((r) => r.moduleId);
    const modules = moduleIds.length
      ? await CurriculumModule.findAll({ where: { id: moduleIds }, attributes: ['id', 'title', 'ageGroup'] })
      : [];
    const titleById = new Map(modules.map((m) => [m.id, moduleLabel(m.title, m.ageGroup)]));

    return rows.map((r) => ({
      moduleId: r.moduleId,
      moduleTitle: titleById.get(r.moduleId) ?? r.moduleId,
      successCount: parseInt(r.successCount, 10),
      revenuePesewas: parseInt(r.revenuePesewas, 10),
    }));
  }

  /** How many students have ever paid vs never have — `hasPaid` is exactly
   *  this signal (flipped true the first time any payment succeeds). */
  async paymentStatusBreakdown() {
    const [paidStudentCount, totalStudentCount] = await Promise.all([
      User.count({ where: { role: 'student', hasPaid: true } }),
      User.count({ where: { role: 'student' } }),
    ]);
    return { paidStudentCount, unpaidStudentCount: totalStudentCount - paidStudentCount, totalStudentCount };
  }

  /**
   * Completion rate for the most-attempted life-skills modules (games are
   * excluded — they have no "finish the module" concept the way a lesson
   * sequence does). Ranked by how many students started, so the chart shows
   * the modules that actually matter, not just whichever have the highest
   * raw completion percentage from one or two students.
   */
  async moduleCompletion() {
    const rows = await StudentModuleProgress.findAll({
      attributes: [
        'moduleId',
        [fn('COUNT', col('id')), 'startedCount'],
        [fn('COUNT', literal(`CASE WHEN "status" = 'completed' THEN 1 END`)), 'completedCount'],
      ],
      group: ['moduleId'],
      order: [[fn('COUNT', col('id')), 'DESC']],
      raw: true,
    });

    const moduleIds = rows.map((r) => r.moduleId);
    const modules = moduleIds.length
      ? await CurriculumModule.findAll({ where: { id: moduleIds, category: 'life-skills' }, attributes: ['id', 'title', 'ageGroup'] })
      : [];
    const titleById = new Map(modules.map((m) => [m.id, moduleLabel(m.title, m.ageGroup)]));

    return rows
      .filter((r) => titleById.has(r.moduleId))
      .slice(0, TOP_N)
      .map((r) => {
        const startedCount = parseInt(r.startedCount, 10);
        const completedCount = parseInt(r.completedCount, 10);
        return {
          moduleId: r.moduleId,
          moduleTitle: titleById.get(r.moduleId),
          startedCount,
          completedCount,
          completionRate: startedCount === 0 ? 0 : Math.round((completedCount / startedCount) * 100),
        };
      });
  }
}

module.exports = new AnalyticsService();
