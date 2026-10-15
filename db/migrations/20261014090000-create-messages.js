'use strict';

const { DataTypes } = require('sequelize');

/**
 * Direct messages between a trainer/admin and a student — a flat inbox
 * (no thread/channel model), one row per message, with the conversation
 * between two users derived as "everything where (sender, recipient) is
 * that pair in either direction".
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('Messages', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      senderId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      recipientId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      body: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      readAt: {
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
    await queryInterface.addIndex('Messages', ['senderId', 'recipientId', 'createdAt'], {
      name: 'messages_sender_recipient_created_at',
    });
    await queryInterface.addIndex('Messages', ['recipientId', 'senderId', 'createdAt'], {
      name: 'messages_recipient_sender_created_at',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Messages');
  },
};
