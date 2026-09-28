'use strict';

const { DataTypes } = require('sequelize');

/**
 * Creates the curriculum store. CurriculumModules is the source of truth: one row per
 * module, with `lessons` holding the frontend's `Lesson[]` verbatim as JSONB.
 * CurriculumLessons/CurriculumExercises are derived lookup tables, rebuilt by
 * curriculumService on every module write and never edited by hand. They exist to
 * enforce id uniqueness, give progress/reward rows a real foreign key target, and let
 * the server reason about completion without parsing JSON.
 *
 * Ids are VARCHAR(255) to match the existing moduleId/lessonId/exerciseId reference
 * columns on the progress, assignment and reward tables.
 *
 * Rows are archived (archivedAt), never deleted, when content is removed — students'
 * earned progress and rewards keep pointing at a real row.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('CurriculumModules', {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: '',
      },
      icon: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: '',
      },
      themeColor: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: '',
      },
      category: {
        type: DataTypes.ENUM('life-skills', 'game'),
        allowNull: false,
      },
      trackName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      ageGroup: {
        type: DataTypes.ENUM('beginner', 'advanced'),
        allowNull: false,
      },
      lessons: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      sortOrder: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      source: {
        type: DataTypes.ENUM('curriculum', 'admin'),
        allowNull: false,
      },
      createdByUserId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      lessonCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      exerciseCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      contentHash: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      version: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      archivedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    });
    await queryInterface.addIndex('CurriculumModules', ['ageGroup']);
    await queryInterface.addIndex('CurriculumModules', ['createdByUserId']);

    await queryInterface.createTable('CurriculumLessons', {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      moduleId: {
        type: DataTypes.STRING,
        allowNull: false,
        references: { model: 'CurriculumModules', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      order: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      week: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      comingSoon: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      exerciseCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      archivedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    });
    await queryInterface.addIndex('CurriculumLessons', ['moduleId']);

    await queryInterface.createTable('CurriculumExercises', {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      lessonId: {
        type: DataTypes.STRING,
        allowNull: false,
        references: { model: 'CurriculumLessons', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      moduleId: {
        type: DataTypes.STRING,
        allowNull: false,
        references: { model: 'CurriculumModules', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      // Free text, not an ENUM: new activity types must not need a migration.
      type: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      order: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      archivedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    });
    await queryInterface.addIndex('CurriculumExercises', ['lessonId']);
    await queryInterface.addIndex('CurriculumExercises', ['moduleId']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('CurriculumExercises');
    await queryInterface.dropTable('CurriculumLessons');
    await queryInterface.dropTable('CurriculumModules');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_CurriculumModules_category";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_CurriculumModules_ageGroup";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_CurriculumModules_source";');
  },
};
