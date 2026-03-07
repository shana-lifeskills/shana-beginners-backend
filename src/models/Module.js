const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Module = sequelize.define('Module', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
  },
  thumbnail: {
    type: DataTypes.STRING,
  },
  icon: {
    type: DataTypes.STRING,
  },
  difficulty: {
    type: DataTypes.ENUM('beginner', 'intermediate', 'advanced'),
    defaultValue: 'beginner',
  },
  published: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
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
  totalLessons: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
});

module.exports = Module;
