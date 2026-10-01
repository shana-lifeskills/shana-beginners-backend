const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/** The real child-registration details collected during student signup —
 *  child info, parent/guardian contact, program interest, needs assessment,
 *  and terms acceptance. One-to-one with a student User. */
const StudentProfile = sequelize.define('StudentProfile', {
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
}, {
  tableName: 'StudentProfiles',
});

module.exports = StudentProfile;
