const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/** One star earned by a student for one exercise (idempotent per userId+exerciseId). */
const StarLog = sequelize.define('StarLog', {
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
  exerciseId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  earnedAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
}, {
  tableName: 'StarLogs',
  indexes: [
    { unique: true, fields: ['userId', 'exerciseId'] },
  ],
});

module.exports = StarLog;
