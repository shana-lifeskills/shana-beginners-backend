'use strict';

require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env') });

const dbPassword = process.env.DB_PASSWORD != null ? String(process.env.DB_PASSWORD) : '';

module.exports = {
  development: {
    username: process.env.DB_USER || 'postgres',
    password: dbPassword,
    database: process.env.DB_NAME || 'shana_elearning',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    dialect: 'postgres',
  },
  test: {
    username: process.env.DB_USER || 'postgres',
    password: dbPassword,
    database: process.env.DB_NAME ? `${process.env.DB_NAME}_test` : 'shana_elearning_test',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    dialect: 'postgres',
  },
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD != null ? String(process.env.DB_PASSWORD) : '',
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    dialect: 'postgres',
  },
};
