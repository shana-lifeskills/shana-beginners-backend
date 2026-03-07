const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Lesson = sequelize.define('Lesson', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  content: {
    type: DataTypes.TEXT,
  },
  videoUrl: {
    type: DataTypes.STRING,
  },
  order: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  duration: {
    type: DataTypes.INTEGER,
  },
  weekNumber: {
    type: DataTypes.INTEGER,
  },
  totalStars: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  totalBadges: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  totalTrophies: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
});

module.exports = Lesson;
