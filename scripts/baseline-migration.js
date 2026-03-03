/**
 * Mark a migration as already applied (insert into SequelizeMeta).
 * Usage: node scripts/baseline-migration.js <migration-filename>
 * Example: node scripts/baseline-migration.js 20260228000004-create-enrollments.js
 */
require('dotenv').config();
const path = require('path');
const { Sequelize } = require('sequelize');

const config = require('../db/config.js')[process.env.NODE_ENV || 'development'];
const sequelize = new Sequelize(config.database, config.username, config.password, {
  host: config.host,
  port: config.port,
  dialect: config.dialect,
  logging: false,
});

const migrationName = process.argv[2] || '20260228000004-create-enrollments.js';

async function run() {
  try {
    await sequelize.authenticate();
    const [rows] = await sequelize.query(
      'SELECT 1 FROM "SequelizeMeta" WHERE name = :name',
      { replacements: { name: migrationName } }
    );
    if (rows && rows.length > 0) {
      console.log(`Migration "${migrationName}" is already recorded as up.`);
      process.exit(0);
      return;
    }
    await sequelize.query('INSERT INTO "SequelizeMeta" (name) VALUES (:name)', {
      replacements: { name: migrationName },
    });
    console.log(`Recorded "${migrationName}" as up in SequelizeMeta.`);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

run();
