'use strict';

const { DataTypes } = require('sequelize');

/**
 * Creates Tasks (trainer-created, file-upload assignments targeted at an age
 * group) and TaskSubmissions (one student's file against one task).
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('Tasks', {
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
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    });
    await queryInterface.addIndex('Tasks', ['ageGroup']);
    await queryInterface.addIndex('Tasks', ['createdByUserId']);

    await queryInterface.createTable('TaskSubmissions', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      taskId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'Tasks', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      studentId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
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
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    });
    await queryInterface.addIndex('TaskSubmissions', ['taskId', 'studentId'], {
      unique: true,
      name: 'task_submissions_task_id_student_id',
    });
    await queryInterface.addIndex('TaskSubmissions', ['studentId']);
    await queryInterface.addIndex('TaskSubmissions', ['status']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('TaskSubmissions');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_TaskSubmissions_status";');

    await queryInterface.dropTable('Tasks');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Tasks_ageGroup";');
  },
};
