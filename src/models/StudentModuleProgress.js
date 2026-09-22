const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Per-student progress through one module of the frontend's static curriculum.
 * `moduleId`/`currentLessonId`/`currentExerciseId` are opaque string ids owned by the
 * frontend content catalog (seed-data.service.ts) — there is no local Modules/Lessons
 * table for them, unlike the unrelated UUID-keyed Module/Lesson/Enrollment/StudentLesson
 * tables elsewhere in this schema.
 */
const StudentModuleProgress = sequelize.define('StudentModuleProgress', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
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
}, {
  tableName: 'StudentModuleProgress',
  indexes: [
    { unique: true, fields: ['userId', 'moduleId'] },
  ],
});

module.exports = StudentModuleProgress;
