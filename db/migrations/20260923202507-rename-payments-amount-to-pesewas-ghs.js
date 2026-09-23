'use strict';

/**
 * Switches Payments to GHS: renames amountKobo -> amountPesewas (same 100x
 * minor-unit convention Paystack uses for every currency, so only the name
 * was Naira-specific) and flips the currency column's default to 'GHS'.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.renameColumn('Payments', 'amountKobo', 'amountPesewas');
    await queryInterface.changeColumn('Payments', 'currency', {
      type: require('sequelize').DataTypes.STRING,
      defaultValue: 'GHS',
    });
    await queryInterface.sequelize.query(`UPDATE "Payments" SET currency = 'GHS' WHERE currency = 'NGN';`);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`UPDATE "Payments" SET currency = 'NGN' WHERE currency = 'GHS';`);
    await queryInterface.changeColumn('Payments', 'currency', {
      type: require('sequelize').DataTypes.STRING,
      defaultValue: 'NGN',
    });
    await queryInterface.renameColumn('Payments', 'amountPesewas', 'amountKobo');
  },
};
