'use strict';

const { DataTypes } = require('sequelize');

/**
 * Tracks which student has already been sent a month-end "you haven't paid"
 * reminder for a given calendar month, so the daily cron job doesn't email
 * the same person every day for the rest of the reminder window.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('PaymentReminderLogs', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      studentId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      // 'YYYY-MM' — one reminder per student per calendar month.
      remindedForMonth: {
        type: DataTypes.STRING(7),
        allowNull: false,
      },
      sentAt: {
        type: DataTypes.DATE,
        allowNull: false,
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
    await queryInterface.addIndex('PaymentReminderLogs', ['studentId', 'remindedForMonth'], {
      unique: true,
      name: 'payment_reminder_logs_student_id_month',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('PaymentReminderLogs');
  },
};
