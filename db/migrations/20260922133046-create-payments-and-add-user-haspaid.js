'use strict';

const { DataTypes } = require('sequelize');

/**
 * Creates the Payments table (one row per Paystack transaction attempt) and adds
 * Users.hasPaid, the server-owned entitlement flag a verified payment sets.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('Payments', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      reference: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      amountKobo: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      currency: {
        type: DataTypes.STRING,
        defaultValue: 'NGN',
      },
      status: {
        type: DataTypes.ENUM('pending', 'success', 'failed'),
        defaultValue: 'pending',
      },
      paidAt: {
        type: DataTypes.DATE,
        allowNull: true,
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
    await queryInterface.addIndex('Payments', ['reference'], {
      unique: true,
      name: 'payments_reference',
    });
    await queryInterface.addIndex('Payments', ['userId']);

    await queryInterface.addColumn('Users', 'hasPaid', {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Users', 'hasPaid');

    await queryInterface.dropTable('Payments');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Payments_status";');
  },
};
