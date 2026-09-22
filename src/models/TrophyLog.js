const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/** One trophy earned by a student for completing one module (idempotent per userId+moduleId). */
const TrophyLog = sequelize.define('TrophyLog', {
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
  earnedAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
}, {
  tableName: 'TrophyLogs',
  indexes: [
    { unique: true, fields: ['userId', 'moduleId'] },
  ],
});

module.exports = TrophyLog;
