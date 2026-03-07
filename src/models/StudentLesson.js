const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const StudentLesson = sequelize.define('StudentLesson', {
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
  lessonId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'Lessons', key: 'id' },
    onDelete: 'CASCADE',
  },
  status: {
    type: DataTypes.ENUM('locked', 'in-progress', 'completed'),
    defaultValue: 'locked',
  },
  progress: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: { min: 0, max: 100 },
  },
  starsEarned: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  badgesEarned: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  trophiesEarned: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
}, {
  tableName: 'StudentLessons',
  indexes: [
    { unique: true, fields: ['userId', 'lessonId'] },
  ],
});

module.exports = StudentLesson;
