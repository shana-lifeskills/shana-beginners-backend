'use strict';

const { DataTypes } = require('sequelize');

/**
 * The real child-registration details collected during student signup
 * (child info, parent/guardian contact, program interest, needs
 * assessment, terms acceptance). Kept in its own table rather than added
 * onto Users since every column here only ever applies to the student
 * role — same "separate per-concern table" pattern as StudentModuleProgress,
 * PaymentReminderLog, etc.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('StudentProfiles', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      middleName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      preferredName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      gender: {
        type: DataTypes.ENUM('male', 'female'),
        allowNull: false,
      },
      dateOfBirth: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      age: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      school: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      gradeClass: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      country: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      parentGuardianName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      parentPhone: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      parentWhatsapp: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      enrolProgram: {
        type: DataTypes.ENUM('soft-skills', 'tech-skills', 'language-skills', 'personal-coaching'),
        allowNull: false,
      },
      howDidYouHear: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: false,
        defaultValue: [],
      },
      howDidYouHearOther: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      growthAreas: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      desiredSkills: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      termsAcceptedAt: {
        type: DataTypes.DATE,
        allowNull: false,
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
  },

  async down(queryInterface) {
    await queryInterface.dropTable('StudentProfiles');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_StudentProfiles_gender";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_StudentProfiles_enrolProgram";');
  },
};
