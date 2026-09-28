'use strict';

const { DataTypes } = require('sequelize');

/**
 * Moves the profile fields the frontend has been keeping only in each browser's
 * localStorage onto Users, so a student's age group, avatar, welcome state and
 * streak follow them across devices.
 *
 * profileImage and avatarUrl are TEXT because the frontend's avatarUrl is a data
 * URL, which does not fit in VARCHAR(255).
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.addColumn('Users', 'ageGroup', {
        type: DataTypes.ENUM('beginner', 'advanced'),
        allowNull: false,
        defaultValue: 'beginner',
      }, { transaction });
      await queryInterface.addColumn('Users', 'avatarId', {
        type: DataTypes.STRING,
        allowNull: true,
      }, { transaction });
      await queryInterface.addColumn('Users', 'avatarUrl', {
        type: DataTypes.TEXT,
        allowNull: true,
      }, { transaction });
      await queryInterface.addColumn('Users', 'hasSeenWelcome', {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      }, { transaction });
      await queryInterface.addColumn('Users', 'streakCount', {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      }, { transaction });
      await queryInterface.addColumn('Users', 'lastActiveDate', {
        type: DataTypes.DATEONLY,
        allowNull: true,
      }, { transaction });
      await queryInterface.changeColumn('Users', 'profileImage', {
        type: DataTypes.TEXT,
        allowNull: true,
      }, { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // Fails loudly (rather than truncating) if any profileImage is now > 255 chars.
      await queryInterface.changeColumn('Users', 'profileImage', {
        type: DataTypes.STRING,
        allowNull: true,
      }, { transaction });
      await queryInterface.removeColumn('Users', 'lastActiveDate', { transaction });
      await queryInterface.removeColumn('Users', 'streakCount', { transaction });
      await queryInterface.removeColumn('Users', 'hasSeenWelcome', { transaction });
      await queryInterface.removeColumn('Users', 'avatarUrl', { transaction });
      await queryInterface.removeColumn('Users', 'avatarId', { transaction });
      await queryInterface.removeColumn('Users', 'ageGroup', { transaction });
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Users_ageGroup";', { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
