/**
 * Run one migration's `up()` directly and record it in SequelizeMeta,
 * bypassing sequelize-cli's sequential runner — needed because an
 * unrelated pre-existing migration (20260925000004-add-curriculum-foreign-keys)
 * is permanently blocked by orphaned dev data and sequelize-cli refuses to
 * run anything dated after it until that's fixed.
 *
 * Usage: node scripts/run-single-migration.js <migration-filename>
 */
require('dotenv').config();
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');

const config = require('../db/config.js')[process.env.NODE_ENV || 'development'];
const sequelize = new Sequelize(config.database, config.username, config.password, {
  host: config.host,
  port: config.port,
  dialect: config.dialect,
  logging: false,
});

const migrationName = process.argv[2];
if (!migrationName) {
  console.error('Usage: node scripts/run-single-migration.js <migration-filename>');
  process.exit(1);
}

async function run() {
  try {
    await sequelize.authenticate();
    const [rows] = await sequelize.query('SELECT 1 FROM "SequelizeMeta" WHERE name = :name', {
      replacements: { name: migrationName },
    });
    if (rows && rows.length > 0) {
      console.log(`Migration "${migrationName}" is already recorded as up — skipping.`);
      return;
    }

    const migration = require(path.join(__dirname, '..', 'db', 'migrations', migrationName));
    const queryInterface = sequelize.getQueryInterface();
    await migration.up(queryInterface, Sequelize);
    await sequelize.query('INSERT INTO "SequelizeMeta" (name) VALUES (:name)', {
      replacements: { name: migrationName },
    });
    console.log(`Ran and recorded "${migrationName}" as up.`);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

run();
