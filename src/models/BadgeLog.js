const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/** One badge earned by a student for completing one lesson (idempotent per userId+lessonId). */
const BadgeLog = sequelize.define('BadgeLog', {
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
  lessonId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  earnedAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
}, {
  tableName: 'BadgeLogs',
  indexes: [
    { unique: true, fields: ['userId', 'lessonId'] },
  ],
});

module.exports = BadgeLog;
