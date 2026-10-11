'use strict';

const { DataTypes } = require('sequelize');

/**
 * Adds subscription/bundle support to Payments, alongside today's
 * pay-one-module-at-a-time rows: `kind` distinguishes a direct module
 * purchase from a fixed-size module bundle or a one-time annual all-access
 * plan; `bundleModuleIds` holds a bundle row's fixed historical grant (never
 * re-derive "how many modules" from the current BUNDLE_SIZE env constant —
 * this array is the source of truth for what that specific payment
 * unlocked); `expiresAt` is entitlement expiry, only meaningful for
 * `kind: 'annual'` and only set once the payment succeeds, not at
 * pending-creation time. Existing rows backfill as `kind: 'module'` for
 * free via the column default.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.addColumn('Payments', 'kind', {
      type: DataTypes.ENUM('module', 'bundle', 'annual'),
      allowNull: false,
      defaultValue: 'module',
    });
    await queryInterface.addColumn('Payments', 'bundleModuleIds', {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
    });
    await queryInterface.addColumn('Payments', 'expiresAt', {
      type: DataTypes.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Payments', 'expiresAt');
    await queryInterface.removeColumn('Payments', 'bundleModuleIds');
    await queryInterface.removeColumn('Payments', 'kind');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Payments_kind";');
  },
};
