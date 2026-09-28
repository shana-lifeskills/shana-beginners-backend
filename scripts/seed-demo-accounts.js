/**
 * Creates (or resets) the demo accounts, mirroring the frontend's seed users in
 * seed-data.service.ts so the README walkthrough works against the real backend.
 * Requires the curriculum to be loaded first (npm run db:setup).
 *
 * Safe to re-run: each account is matched by email and reset to its demo state
 * (profile, password, assignments). Progress and rewards are left alone. Refuses to
 * run when NODE_ENV=production unless --allow-production is passed.
 *
 * Usage:
 *   npm run db:seed:demo
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize, User, CurriculumModule, ModuleAssignment } = require('../src/models');

// Ava's streak is "5 days, last active yesterday", so her next login continues it (→ 6)
// instead of the backend resetting it to 1 for a missed day.
const yesterday = () => new Date(Date.now() - 86400000).toISOString().slice(0, 10);

// Mirrors `ava.assignedModuleIds` / `leo.assignedModuleIds` in seed-data.service.ts.
const AVA_MODULES = [
  'module-counting-critters', 'module-identity', 'module-confidence', 'module-planning',
  'module-strength-match', 'module-empathy', 'module-respect', 'module-listening',
  'module-speaking', 'module-expression', 'module-etiquette', 'module-habits',
  'module-creativity', 'module-strategizing', 'module-thinking', 'module-choices',
  'module-budgeting', 'module-savings', 'module-discipline', 'module-service',
  'module-teamwork', 'module-hygiene', 'module-wellness', 'module-nutrition',
];
const LEO_MODULES = ['module-identity-advanced', 'module-planning-advanced', 'module-confidence-advanced'];

const ACCOUNTS = [
  {
    email: 'trainer@shana.dev', password: 'Trainer123', role: 'admin',
    firstName: 'Sam', lastName: 'Rivera', avatarId: 'theo', ageGroup: 'beginner',
    hasSeenWelcome: true, streakCount: 0, lastActiveDate: null, modules: [],
  },
  {
    email: 'coach@shana.dev', password: 'Coach1234', role: 'instructor',
    firstName: 'Demo', lastName: 'Trainer', avatarId: 'kai', ageGroup: 'beginner',
    hasSeenWelcome: true, streakCount: 0, lastActiveDate: null, modules: [],
  },
  {
    email: 'ava@shana.dev', password: 'Ava12345', role: 'student',
    firstName: 'Ava', lastName: 'Stone', avatarId: 'zoe', ageGroup: 'beginner',
    hasSeenWelcome: true, streakCount: 5, lastActiveDate: yesterday(), modules: AVA_MODULES,
  },
  {
    email: 'leo@shana.dev', password: 'Leo12345', role: 'student',
    firstName: 'Leo', lastName: 'Nguyen', avatarId: 'milo', ageGroup: 'advanced',
    hasSeenWelcome: false, streakCount: 0, lastActiveDate: null, modules: LEO_MODULES,
  },
];

async function run() {
  if (process.env.NODE_ENV === 'production' && !process.argv.includes('--allow-production')) {
    console.error('✘ NODE_ENV is production — demo accounts use published passwords. Pass --allow-production to override.');
    process.exitCode = 1;
    return;
  }

  const wanted = [...new Set(ACCOUNTS.flatMap((a) => a.modules))];
  const found = await CurriculumModule.findAll({ where: { id: wanted, archivedAt: null }, attributes: ['id'] });
  const missing = wanted.filter((id) => !found.some((m) => m.id === id));
  if (missing.length) {
    console.error(`✘ Curriculum is missing ${missing.length} module(s) the demo accounts need: ${missing.join(', ')}`);
    console.error('  Run `npm run db:setup` (or `npm run db:seed:curriculum`) first. Nothing was changed.');
    process.exitCode = 1;
    return;
  }

  const transaction = await sequelize.transaction();
  try {
    const admin = { id: null };
    for (const account of ACCOUNTS) {
      const { email, password, modules, ...profile } = account;
      const fields = { ...profile, email, emailVerified: true, hasPaid: true };
      let user = await User.findOne({ where: { email }, transaction });
      if (user) {
        // The model only hashes on create, so a reset hashes explicitly.
        await user.update({ ...fields, password: await bcrypt.hash(password, 12) }, { transaction });
      } else {
        user = await User.create({ ...fields, password }, { transaction });
      }
      if (account.role === 'admin') admin.id = user.id;

      for (const moduleId of modules) {
        await ModuleAssignment.findOrCreate({
          where: { userId: user.id, moduleId },
          defaults: { assignedByUserId: admin.id, assignedAt: new Date() },
          transaction,
        });
      }
      console.log(`  ${email.padEnd(20)} ${password.padEnd(11)} ${account.role.padEnd(10)} ${modules.length} module(s) assigned`);
    }
    await transaction.commit();
    console.log('✔ Demo accounts ready.');
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

run()
  .catch((error) => {
    console.error(`✘ ${error.message}; nothing was changed.`);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
