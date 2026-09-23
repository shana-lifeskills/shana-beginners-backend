const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/** One Paystack transaction attempt for a student's course-access payment. */
const Payment = sequelize.define('Payment', {
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
  reference: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  /** Amount in pesewas (GHS's smallest unit — 100 pesewas = 1 GHS), same
   *  100x-multiplier convention Paystack uses for every currency it supports. */
  amountPesewas: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  currency: {
    type: DataTypes.STRING,
    defaultValue: 'GHS',
  },
  status: {
    type: DataTypes.ENUM('pending', 'success', 'failed'),
    defaultValue: 'pending',
  },
  paidAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  channel: {
    type: DataTypes.ENUM('card', 'mobile_money'),
    defaultValue: 'card',
  },
  /** 'mtn' | 'vod' (Telecel — still Paystack's legacy Vodafone Cash code) | 'atl' (AirtelTigo). */
  provider: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  tableName: 'Payments',
  indexes: [
    { unique: true, fields: ['reference'] },
    { fields: ['userId'] },
  ],
});

module.exports = Payment;
