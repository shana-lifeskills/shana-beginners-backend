const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/** A trainer-created assignment students in a given age group submit a file against. */
const Task = sequelize.define('Task', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  instructions: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  ageGroup: {
    type: DataTypes.ENUM('beginner', 'advanced'),
    allowNull: false,
  },
  dueAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  createdByUserId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
    onDelete: 'CASCADE',
  },
}, {
  tableName: 'Tasks',
  indexes: [
    { fields: ['ageGroup'] },
    { fields: ['createdByUserId'] },
  ],
});

module.exports = Task;
