// One-off runner for a single migration, bypassing sequelize-cli's strict
// in-order runner (which aborts on the pre-existing, unrelated
// 20260925000004-add-curriculum-foreign-keys migration due to dev/test
// orphan rows that predate this work). Mirrors what db:migrate would do:
// run up()/down(), then record/remove it in SequelizeMeta.
const path = require('path');
const sequelize = require('../src/config/database');
const { Sequelize } = require('sequelize');

const migrationName = process.argv[2];
const direction = process.argv[3] || 'up';
if (!migrationName) {
  console.error('Usage: node scripts/run-single-migration.js <migration-filename> [up|down]');
  process.exit(1);
}

const migrationPath = path.resolve(__dirname, '../db/migrations', migrationName);

async function main() {
  const migration = require(migrationPath);
  const queryInterface = sequelize.getQueryInterface();

  if (direction === 'up') {
    await migration.up(queryInterface, Sequelize);
    await sequelize.query(
      'INSERT INTO "SequelizeMeta" (name) VALUES (:name) ON CONFLICT DO NOTHING',
      { replacements: { name: migrationName } }
    );
    console.log(`Applied ${migrationName}`);
  } else {
    await migration.down(queryInterface, Sequelize);
    await sequelize.query('DELETE FROM "SequelizeMeta" WHERE name = :name', {
      replacements: { name: migrationName },
    });
    console.log(`Reverted ${migrationName}`);
  }
  await sequelize.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
