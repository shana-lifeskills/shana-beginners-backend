const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/** Derived lookup row for one lesson of a CurriculumModule — written only by curriculumService. */
const CurriculumLesson = sequelize.define('CurriculumLesson', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true,
  },
  moduleId: {
    type: DataTypes.STRING,
    allowNull: false,
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
}, {
  tableName: 'CurriculumLessons',
});

module.exports = CurriculumLesson;
