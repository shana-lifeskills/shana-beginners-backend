const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/** One row per student per calendar month they've been sent a month-end
 *  "you still need to pay" reminder — prevents the daily cron from re-emailing
 *  the same student every day it's within the reminder window. */
const PaymentReminderLog = sequelize.define('PaymentReminderLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  studentId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'Users', key: 'id' },
    onDelete: 'CASCADE',
  },
  // 'YYYY-MM'
  remindedForMonth: {
    type: DataTypes.STRING(7),
    allowNull: false,
  },
  sentAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
}, {
  tableName: 'PaymentReminderLogs',
  indexes: [
    { fields: ['studentId', 'remindedForMonth'], unique: true, name: 'payment_reminder_logs_student_id_month' },
  ],
});

module.exports = PaymentReminderLog;
