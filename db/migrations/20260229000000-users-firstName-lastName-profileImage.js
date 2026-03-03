'use strict';

const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const tableInfo = await queryInterface.describeTable('Users');
    if (tableInfo.name) {
      await queryInterface.addColumn('Users', 'firstName', { type: DataTypes.STRING, allowNull: true });
      await queryInterface.addColumn('Users', 'lastName', { type: DataTypes.STRING, allowNull: true });
      await queryInterface.addColumn('Users', 'profileImage', { type: DataTypes.STRING, allowNull: true });
      await queryInterface.sequelize.query(
        'UPDATE "Users" SET "firstName" = COALESCE("name", \'\'), "lastName" = \'\' WHERE "firstName" IS NULL'
      );
      await queryInterface.removeColumn('Users', 'name');
      await queryInterface.changeColumn('Users', 'firstName', { type: DataTypes.STRING, allowNull: false });
      await queryInterface.changeColumn('Users', 'lastName', { type: DataTypes.STRING, allowNull: false });
    } else if (!tableInfo.firstName) {
      await queryInterface.addColumn('Users', 'firstName', { type: DataTypes.STRING, allowNull: false });
      await queryInterface.addColumn('Users', 'lastName', { type: DataTypes.STRING, allowNull: false });
      await queryInterface.addColumn('Users', 'profileImage', { type: DataTypes.STRING, allowNull: true });
    }
  },

  async down(queryInterface) {
    const tableInfo = await queryInterface.describeTable('Users');
    if (tableInfo.firstName) {
      await queryInterface.addColumn('Users', 'name', { type: DataTypes.STRING, allowNull: true });
      await queryInterface.sequelize.query(
        'UPDATE "Users" SET "name" = COALESCE("firstName", \'\') || \' \' || COALESCE("lastName", \'\')'
      );
      await queryInterface.changeColumn('Users', 'name', { type: DataTypes.STRING, allowNull: false });
      await queryInterface.removeColumn('Users', 'firstName');
      await queryInterface.removeColumn('Users', 'lastName');
      await queryInterface.removeColumn('Users', 'profileImage');
    }
  },
};
