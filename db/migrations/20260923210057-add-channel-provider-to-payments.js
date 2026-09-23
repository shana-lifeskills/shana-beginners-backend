'use strict';

const { DataTypes } = require('sequelize');

/**
 * Adds channel/provider to Payments so mobile money charges (MTN, Telecel,
 * AirtelTigo) can be tracked alongside card payments in the same table.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.addColumn('Payments', 'channel', {
      type: DataTypes.ENUM('card', 'mobile_money'),
      defaultValue: 'card',
    });
    await queryInterface.addColumn('Payments', 'provider', {
      type: DataTypes.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Payments', 'provider');
    await queryInterface.removeColumn('Payments', 'channel');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Payments_channel";');
  },
};
