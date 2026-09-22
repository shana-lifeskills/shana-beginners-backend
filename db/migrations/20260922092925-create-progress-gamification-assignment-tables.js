'use strict';

const { DataTypes } = require('sequelize');

/**
 * Creates the parallel progress/gamification/assignment schema that tracks per-student
 * state for the frontend's real (string-id) curriculum, separately from the unused
 * UUID-keyed Module/Lesson/Enrollment/StudentLesson system.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('StudentModuleProgress', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      moduleId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('not-started', 'in-progress', 'completed'),
        defaultValue: 'not-started',
      },
      completedExerciseIds: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        defaultValue: [],
      },
      completedLessonIds: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        defaultValue: [],
      },
      currentLessonId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      currentExerciseId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      startedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      completedAt: {
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
    await queryInterface.addIndex('StudentModuleProgress', ['userId', 'moduleId'], {
      unique: true,
      name: 'student_module_progress_user_id_module_id',
    });
    await queryInterface.addIndex('StudentModuleProgress', ['userId']);

    await queryInterface.createTable('StudentSubmissions', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      studentName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      moduleId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      lessonId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      exerciseId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      values: {
        type: DataTypes.JSONB,
        allowNull: false,
      },
      submittedAt: {
        type: DataTypes.DATE,
        allowNull: false,
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
    await queryInterface.addIndex('StudentSubmissions', ['userId', 'exerciseId'], {
      unique: true,
      name: 'student_submissions_user_id_exercise_id',
    });
    await queryInterface.addIndex('StudentSubmissions', ['exerciseId']);

    await queryInterface.createTable('StarLogs', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      moduleId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      exerciseId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      earnedAt: {
        type: DataTypes.DATE,
        allowNull: false,
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
    await queryInterface.addIndex('StarLogs', ['userId', 'exerciseId'], {
      unique: true,
      name: 'star_logs_user_id_exercise_id',
    });
    await queryInterface.addIndex('StarLogs', ['userId']);

    await queryInterface.createTable('BadgeLogs', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      moduleId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      lessonId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      earnedAt: {
        type: DataTypes.DATE,
        allowNull: false,
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
    await queryInterface.addIndex('BadgeLogs', ['userId', 'lessonId'], {
      unique: true,
      name: 'badge_logs_user_id_lesson_id',
    });
    await queryInterface.addIndex('BadgeLogs', ['userId']);

    await queryInterface.createTable('TrophyLogs', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      moduleId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      earnedAt: {
        type: DataTypes.DATE,
        allowNull: false,
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
    await queryInterface.addIndex('TrophyLogs', ['userId', 'moduleId'], {
      unique: true,
      name: 'trophy_logs_user_id_module_id',
    });
    await queryInterface.addIndex('TrophyLogs', ['userId']);

    await queryInterface.createTable('ModuleAssignments', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      moduleId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      assignedByUserId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      assignedAt: {
        type: DataTypes.DATE,
        allowNull: false,
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
    await queryInterface.addIndex('ModuleAssignments', ['userId', 'moduleId'], {
      unique: true,
      name: 'module_assignments_user_id_module_id',
    });
    await queryInterface.addIndex('ModuleAssignments', ['moduleId']);
  },

  async down(queryInterface) {
    // Reverse in opposite order.
    await queryInterface.dropTable('ModuleAssignments');

    await queryInterface.dropTable('TrophyLogs');

    await queryInterface.dropTable('BadgeLogs');

    await queryInterface.dropTable('StarLogs');

    await queryInterface.dropTable('StudentSubmissions');

    await queryInterface.dropTable('StudentModuleProgress');
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_StudentModuleProgress_status";'
    );
  },
};
