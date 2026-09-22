const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/** A trainer/admin assigning one module (frontend-owned string id) to one student. */
const ModuleAssignment = sequelize.define('ModuleAssignment', {
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
  assignedByUserId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'Users', key: 'id' },
    onDelete: 'SET NULL',
  },
  assignedAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
}, {
  tableName: 'ModuleAssignments',
  indexes: [
    { unique: true, fields: ['userId', 'moduleId'] },
    { fields: ['moduleId'] },
  ],
});

module.exports = ModuleAssignment;
