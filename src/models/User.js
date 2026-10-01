const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  firstName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  lastName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: { isEmail: true },
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  profileImage: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  role: {
    type: DataTypes.ENUM('student', 'instructor', 'admin'),
    defaultValue: 'student',
  },
  stars: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  badges: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  trophies: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  modulesCompleted: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  // Real Paystack keys are wired in now, so new accounts default to unpaid
  // again — the payment step (Pay to Access Module) genuinely gates access.
  // (Previously defaulted to `true` as a temporary demo bypass while keys
  // were still dummy placeholders.)
  hasPaid: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  emailVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
}, {
  hooks: {
    beforeCreate: async (user) => {
      user.password = await bcrypt.hash(user.password, 12);
    },
  },
});

User.prototype.validatePassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

module.exports = User;
