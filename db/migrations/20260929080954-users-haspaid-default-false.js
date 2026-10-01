'use strict';

const { DataTypes } = require('sequelize');

/**
 * Flips Users.hasPaid's column default back to false now that real
 * Paystack keys are wired in (see User.js) — new accounts should
 * genuinely be gated behind payment again, not auto-marked paid. Does
 * NOT touch any existing row's value, only the default applied to rows
 * inserted from now on.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.changeColumn('Users', 'hasPaid', {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    });
  },

  async down(queryInterface) {
    await queryInterface.changeColumn('Users', 'hasPaid', {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    });
  },
};
