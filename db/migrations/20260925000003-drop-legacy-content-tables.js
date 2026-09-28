'use strict';

/**
 * Drops the legacy UUID-keyed content system (Modules, Lessons, Enrollments,
 * StudentLessons). The frontend never used it — its real curriculum now lives in
 * CurriculumModules — and keeping it around invites building against the wrong model.
 *
 * `down` recreates the tables' structure exactly as it was, but not their rows. To get
 * the rows back, restore them from the pg_dump taken before this migration
 * (backups/pre-curriculum-*.dump), e.g.:
 *   pg_restore --data-only -t Modules -t Lessons -t Enrollments -t StudentLessons -d <db> <dump>
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.dropTable('StudentLessons', { transaction });
      await queryInterface.dropTable('Enrollments', { transaction });
      await queryInterface.dropTable('Lessons', { transaction });
      await queryInterface.dropTable('Modules', { transaction });
      for (const type of ['enum_StudentLessons_status', 'enum_Enrollments_status', 'enum_Modules_difficulty']) {
        await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "${type}";`, { transaction });
      }
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE TYPE "enum_Modules_difficulty" AS ENUM ('beginner', 'intermediate', 'advanced');
      CREATE TYPE "enum_Enrollments_status" AS ENUM ('locked', 'unlocked', 'completed');
      CREATE TYPE "enum_StudentLessons_status" AS ENUM ('locked', 'in-progress', 'completed');

      CREATE TABLE "Modules" (
        id uuid PRIMARY KEY,
        title varchar(255) NOT NULL,
        description text,
        thumbnail varchar(255),
        difficulty "enum_Modules_difficulty" DEFAULT 'beginner',
        published boolean DEFAULT false,
        "createdAt" timestamptz NOT NULL,
        "updatedAt" timestamptz NOT NULL,
        "instructorId" uuid REFERENCES "Users"(id) ON UPDATE CASCADE ON DELETE SET NULL,
        icon varchar(255),
        "totalStars" integer DEFAULT 0,
        "totalBadges" integer DEFAULT 0,
        "totalTrophies" integer DEFAULT 0,
        "totalLessons" integer DEFAULT 0
      );

      CREATE TABLE "Lessons" (
        id uuid PRIMARY KEY,
        title varchar(255) NOT NULL,
        content text,
        "videoUrl" varchar(255),
        "order" integer NOT NULL,
        duration integer,
        "createdAt" timestamptz NOT NULL,
        "updatedAt" timestamptz NOT NULL,
        "moduleId" uuid REFERENCES "Modules"(id) ON UPDATE CASCADE ON DELETE CASCADE,
        "weekNumber" integer,
        "totalStars" integer DEFAULT 0,
        "totalBadges" integer DEFAULT 0,
        "totalTrophies" integer DEFAULT 0
      );

      CREATE TABLE "Enrollments" (
        id uuid PRIMARY KEY,
        "userId" uuid NOT NULL REFERENCES "Users"(id) ON UPDATE CASCADE ON DELETE CASCADE,
        "moduleId" uuid NOT NULL REFERENCES "Modules"(id) ON UPDATE CASCADE ON DELETE CASCADE,
        "enrolledAt" timestamptz,
        "progressPercent" integer DEFAULT 0,
        "createdAt" timestamptz NOT NULL,
        "updatedAt" timestamptz NOT NULL,
        status "enum_Enrollments_status" DEFAULT 'locked',
        "starsEarned" integer DEFAULT 0,
        "badgesEarned" integer DEFAULT 0,
        "trophiesEarned" integer DEFAULT 0,
        UNIQUE ("userId", "moduleId")
      );

      CREATE TABLE "StudentLessons" (
        id uuid PRIMARY KEY,
        "userId" uuid NOT NULL REFERENCES "Users"(id) ON UPDATE CASCADE ON DELETE CASCADE,
        "lessonId" uuid NOT NULL REFERENCES "Lessons"(id) ON UPDATE CASCADE ON DELETE CASCADE,
        status "enum_StudentLessons_status" DEFAULT 'locked',
        progress integer DEFAULT 0,
        "starsEarned" integer DEFAULT 0,
        "badgesEarned" integer DEFAULT 0,
        "trophiesEarned" integer DEFAULT 0,
        "createdAt" timestamptz NOT NULL,
        "updatedAt" timestamptz NOT NULL
      );
      CREATE INDEX student_lessons_lesson_id ON "StudentLessons" ("lessonId");
      CREATE INDEX student_lessons_user_id ON "StudentLessons" ("userId");
      CREATE UNIQUE INDEX student_lessons_user_id_lesson_id ON "StudentLessons" ("userId", "lessonId");
    `);
  },
};
