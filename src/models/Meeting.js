const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/** A trainer-scheduled video meeting with one student, backed by an externally-hosted call room. */
const Meeting = sequelize.define('Meeting', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  hostId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
    onDelete: 'CASCADE',
  },
  studentId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
    onDelete: 'CASCADE',
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  scheduledAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  roomUrl: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  canceledAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'Meetings',
  indexes: [
    { fields: ['hostId', 'scheduledAt'] },
    { fields: ['studentId', 'scheduledAt'] },
  ],
});

module.exports = Meeting;
