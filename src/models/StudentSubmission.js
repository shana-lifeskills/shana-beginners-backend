const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/** A student's typed answer to a share-prompt exercise (frontend-owned string ids). */
const StudentSubmission = sequelize.define('StudentSubmission', {
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
  studentName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  moduleId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  lessonId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  exerciseId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  values: {
    type: DataTypes.JSONB,
    allowNull: false,
  },
  submittedAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
}, {
  tableName: 'StudentSubmissions',
  indexes: [
    { unique: true, fields: ['userId', 'exerciseId'] },
  ],
});

module.exports = StudentSubmission;
