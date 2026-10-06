'use strict';

const { DataTypes } = require('sequelize');

/**
 * Adds Payments.moduleId so a payment can be tied to one specific module
 * (pay-as-you-go unlocking) instead of only ever granting account-wide
 * access. Nullable — existing historical payments predate per-module
 * pricing and have no module to attribute themselves to; they keep
 * counting only toward Users.hasPaid (now just an "has ever paid" signal),
 * not toward any specific module's unlocked state.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.addColumn('Payments', 'moduleId', {
      type: DataTypes.STRING,
      allowNull: true,
    });
    await queryInterface.addIndex('Payments', ['userId', 'moduleId']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('Payments', ['userId', 'moduleId']);
    await queryInterface.removeColumn('Payments', 'moduleId');
  },
};
