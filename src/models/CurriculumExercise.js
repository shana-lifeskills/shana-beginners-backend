const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/** Derived lookup row for one exercise of a CurriculumModule — written only by curriculumService. */
const CurriculumExercise = sequelize.define('CurriculumExercise', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true,
  },
  lessonId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  moduleId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
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
}, {
  tableName: 'CurriculumExercises',
});

module.exports = CurriculumExercise;
