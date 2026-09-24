const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/** One student's file submission against a Task — resubmitting overwrites the
 *  previous file (only the latest submission is kept, see taskService). */
const TaskSubmission = sequelize.define('TaskSubmission', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  taskId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'Tasks', key: 'id' },
    onDelete: 'CASCADE',
  },
  studentId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
    onDelete: 'CASCADE',
  },
  fileName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  filePath: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  fileSize: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  submittedAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('pending', 'reviewed'),
    defaultValue: 'pending',
  },
  reviewedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  reviewedByUserId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'Users', key: 'id' },
    onDelete: 'SET NULL',
  },
}, {
  tableName: 'TaskSubmissions',
  indexes: [
    { unique: true, fields: ['taskId', 'studentId'] },
    { fields: ['studentId'] },
    { fields: ['status'] },
  ],
});

module.exports = TaskSubmission;
