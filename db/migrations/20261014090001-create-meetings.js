'use strict';

const { DataTypes } = require('sequelize');

/**
 * A trainer-scheduled video meeting with one student. `roomUrl` points at
 * an externally-hosted call room (Jitsi Meet) — this table only tracks
 * who it's with and when, not any call state.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('Meetings', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      hostId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      studentId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      scheduledAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      roomUrl: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      canceledAt: {
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
    await queryInterface.addIndex('Meetings', ['hostId', 'scheduledAt'], { name: 'meetings_host_scheduled_at' });
    await queryInterface.addIndex('Meetings', ['studentId', 'scheduledAt'], { name: 'meetings_student_scheduled_at' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Meetings');
  },
};
