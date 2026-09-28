'use strict';

/**
 * Points the progress, assignment, reward and submission tables at real curriculum
 * rows, so no record can reference a module/lesson/exercise that doesn't exist.
 *
 * Deliberately NOT constrained: StarLogs.exerciseId. The story-tabs activity awards
 * bonus stars against synthetic ids (`${questionId}__starter`) that are not exercises.
 *
 * Requires the curriculum to be loaded first — `npm run db:setup` runs the migrations,
 * the curriculum seed and then this migration in the right order. Before adding any
 * constraint it lists every row whose id isn't in the curriculum and aborts, so nothing
 * is half-applied and you can decide what to do with those rows.
 *
 * ON DELETE RESTRICT: curriculum rows are archived, never deleted, so a delete that
 * would orphan a student's history is refused.
 *
 * @type {import('sequelize-cli').Migration}
 */
const CONSTRAINTS = [
  { table: 'StudentModuleProgress', column: 'moduleId', target: 'CurriculumModules' },
  { table: 'ModuleAssignments', column: 'moduleId', target: 'CurriculumModules' },
  { table: 'StarLogs', column: 'moduleId', target: 'CurriculumModules' },
  { table: 'BadgeLogs', column: 'moduleId', target: 'CurriculumModules' },
  { table: 'BadgeLogs', column: 'lessonId', target: 'CurriculumLessons' },
  { table: 'TrophyLogs', column: 'moduleId', target: 'CurriculumModules' },
  { table: 'StudentSubmissions', column: 'moduleId', target: 'CurriculumModules' },
  { table: 'StudentSubmissions', column: 'lessonId', target: 'CurriculumLessons' },
  { table: 'StudentSubmissions', column: 'exerciseId', target: 'CurriculumExercises' },
];

const constraintName = ({ table, column }) => `${table}_${column}_curriculum_fkey`;

module.exports = {
  async up(queryInterface) {
    const orphans = [];
    for (const c of CONSTRAINTS) {
      const [rows] = await queryInterface.sequelize.query(
        `SELECT t."${c.column}" AS id, COUNT(*)::int AS n
           FROM "${c.table}" t
           LEFT JOIN "${c.target}" r ON r.id = t."${c.column}"
          WHERE r.id IS NULL
          GROUP BY t."${c.column}"
          ORDER BY n DESC`
      );
      rows.forEach((row) => orphans.push(`${c.table}.${c.column} = "${row.id}" (${row.n} row${row.n === 1 ? '' : 's'}) — not in ${c.target}`));
    }
    if (orphans.length) {
      throw new Error(
        `Cannot add curriculum foreign keys: ${orphans.length} id(s) don't match the curriculum.\n` +
        `  If the curriculum isn't loaded yet, run \`npm run db:seed:curriculum\` and migrate again.\n` +
        orphans.map((o) => `  - ${o}`).join('\n')
      );
    }

    const transaction = await queryInterface.sequelize.transaction();
    try {
      for (const c of CONSTRAINTS) {
        await queryInterface.addConstraint(c.table, {
          fields: [c.column],
          type: 'foreign key',
          name: constraintName(c),
          references: { table: c.target, field: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
          transaction,
        });
      }
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      for (const c of CONSTRAINTS) {
        await queryInterface.removeConstraint(c.table, constraintName(c), { transaction });
      }
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
