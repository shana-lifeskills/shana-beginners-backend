const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/** A single direct message from one user to another (trainer<->student). */
const Message = sequelize.define('Message', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  senderId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
    onDelete: 'CASCADE',
  },
  recipientId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
    onDelete: 'CASCADE',
  },
  body: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  readAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'Messages',
  indexes: [
    { fields: ['senderId', 'recipientId', 'createdAt'] },
    { fields: ['recipientId', 'senderId', 'createdAt'] },
  ],
});

module.exports = Message;
