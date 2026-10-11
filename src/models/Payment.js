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
  /** Which curriculum module this payment unlocks (pay-as-you-go) — null for
   *  historical payments made before per-module pricing existed, and for
   *  kind='bundle'/'annual' rows (see bundleModuleIds/expiresAt below). */
  moduleId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  /** 'module' (default, today's pay-one-at-a-time flow) | 'bundle' (a
   *  fixed-size module pack) | 'annual' (one-time, covers everything for a
   *  year). Existing rows backfill as 'module' via the default. */
  kind: {
    type: DataTypes.ENUM('module', 'bundle', 'annual'),
    allowNull: false,
    defaultValue: 'module',
  },
  /** Only set for kind='bundle' — the specific module ids this payment
   *  unlocked. This is the row's fixed historical grant: never re-derive
   *  "how many modules" from the *current* BUNDLE_SIZE env constant, this
   *  array is the only source of truth for what this payment unlocked. */
  bundleModuleIds: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    allowNull: true,
  },
  /** Only set for kind='annual', at the moment it succeeds (paidAt + 1
   *  year) — represents entitlement expiry, not payment-attempt expiry; a
   *  still-pending annual payment has no expiresAt yet. */
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'Payments',
  indexes: [
    { unique: true, fields: ['reference'] },
    { fields: ['userId'] },
    { fields: ['userId', 'moduleId'] },
  ],
});

module.exports = Payment;
