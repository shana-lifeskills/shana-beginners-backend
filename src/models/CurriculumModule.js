const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * One module of the curriculum — the source of truth for content. `lessons` is the
 * frontend's `Lesson[]` stored verbatim; see curriculumService for how writes keep the
 * derived CurriculumLesson/CurriculumExercise lookup rows in step with it.
 */
const CurriculumModule = sequelize.define('CurriculumModule', {
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
}, {
  tableName: 'CurriculumModules',
});

module.exports = CurriculumModule;
