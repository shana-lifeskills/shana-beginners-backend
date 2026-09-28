/**
 * Verifies the curriculum store end to end.
 *
 * Run with: npm run test:curriculum
 * Requires: `npm run db:setup` and `npm run db:seed:demo` done; the API running on
 * API_URL (default http://localhost:3000) for the HTTP section.
 *
 * Every check that writes runs inside a transaction that is rolled back, and the one
 * HTTP check that must commit (a real signup) deletes its user afterwards — running
 * this leaves the database as it found it.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const {
  sequelize, User, CurriculumModule, CurriculumLesson, CurriculumExercise, StudentModuleProgress, StarLog,
} = require('../src/models');
const curriculumService = require('../src/services/curriculumService');
const { stableStringify } = require('../src/services/curriculumService');

const API = process.env.API_URL || 'http://localhost:3000';
const EXPORT_FILE = path.resolve(__dirname, '..', 'db', 'curriculum', 'curriculum.json');

let passed = 0;
const failures = [];
function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ✔ ${name}`);
  } else {
    failures.push(name);
    console.log(`  ✘ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

/** Runs `fn` in a transaction and always rolls it back. */
async function inRollback(fn) {
  const transaction = await sequelize.transaction();
  try {
    return await fn(transaction);
  } finally {
    await transaction.rollback();
  }
}

async function expectRejection(promise) {
  try {
    await promise;
    return null;
  } catch (error) {
    return error;
  }
}

const clone = (value) => JSON.parse(JSON.stringify(value));

async function dataChecks(exported) {
  console.log('\nStored content matches the export');
  const modules = await CurriculumModule.findAll({ where: { source: 'curriculum' }, order: [['sortOrder', 'ASC']] });
  const active = modules.filter((m) => m.archivedAt === null);
  check(`${exported.counts.modules} active curriculum modules`, active.length === exported.counts.modules, `got ${active.length}`);
  check(
    `${exported.counts.lessons} lesson lookup rows`,
    (await CurriculumLesson.count({ where: { archivedAt: null } })) === exported.counts.lessons
  );
  check(
    `${exported.counts.exercises} exercise lookup rows`,
    (await CurriculumExercise.count({ where: { archivedAt: null } })) === exported.counts.exercises
  );
  check('module order matches the export', active.map((m) => m.id).join() === exported.modules.map((m) => m.id).join());

  const mismatched = exported.modules.filter((source) => {
    const row = active.find((m) => m.id === source.id);
    if (!row) return true;
    const { createdAt, createdByTrainerId, ...rebuilt } = curriculumService.toModuleDto(row);
    return stableStringify(rebuilt) !== stableStringify(source);
  });
  check('every module rebuilds to exactly the frontend shape', mismatched.length === 0, mismatched.map((m) => m.id).join(', '));

  const countsWrong = active.filter((row) => {
    const source = exported.modules.find((m) => m.id === row.id);
    return row.lessonCount !== source.lessons.length
      || row.exerciseCount !== source.lessons.reduce((n, l) => n + l.exercises.length, 0);
  });
  check('stored lesson/exercise counts are correct', countsWrong.length === 0, countsWrong.map((m) => m.id).join(', '));
}

async function behaviourChecks(exported) {
  console.log('\nWrites are safe');
  const savings = clone(exported.modules.find((m) => m.id === 'module-savings'));
  const savingsIndex = exported.modules.findIndex((m) => m.id === 'module-savings');

  const results = await inRollback(async (t) => {
    const out = [];
    for (const [i, mod] of exported.modules.entries()) out.push(await curriculumService.upsertModule(mod, { source: 'curriculum', sortOrder: i }, t));
    return out;
  });
  check('re-seeding identical content changes nothing', results.every((r) => r.status === 'unchanged'));

  const dup = clone(savings);
  dup.lessons[0].exercises[1].id = dup.lessons[0].exercises[0].id;
  const dupErrors = curriculumService.validateModule(dup);
  check('duplicate exercise id inside a module is rejected', dupErrors.some((e) => e.includes('duplicate exercise id')), dupErrors.join('; '));

  const thief = clone(savings);
  thief.id = 'test-module-reuses-ids';
  thief.lessons = [clone(savings.lessons[0])];
  thief.lessons[0].id = 'test-lesson-new';
  const reuseError = await inRollback((t) => expectRejection(curriculumService.upsertModule(thief, { source: 'admin', sortOrder: 99 }, t)));
  check(
    'reusing another module\'s exercise id is rejected',
    reuseError?.details?.some((d) => d.includes('already belongs to module "module-savings"')),
    reuseError?.message ?? 'no error'
  );

  const edited = clone(savings);
  const removed = edited.lessons[0].exercises.pop();
  const edit = await inRollback(async (t) => {
    const result = await curriculumService.upsertModule(edited, { source: 'curriculum', sortOrder: savingsIndex }, t);
    const archivedRow = await CurriculumExercise.findByPk(removed.id, { transaction: t });
    return { result, archivedRow };
  });
  check('changed content gets a new version', edit.result.status === 'updated' && edit.result.version === 2, JSON.stringify(edit.result));
  check('a removed exercise is archived, not deleted', edit.archivedRow !== null && edit.archivedRow.archivedAt !== null);

  const cycle = await inRollback(async (t) => {
    const archived = await curriculumService.archiveModulesNotIn(exported.modules.filter((m) => m.id !== 'module-savings').map((m) => m.id), { source: 'curriculum' }, t);
    const restored = await curriculumService.upsertModule(savings, { source: 'curriculum', sortOrder: savingsIndex }, t);
    return { archived, restored };
  });
  const savingsLessons = savings.lessons.length;
  const savingsExercises = savings.lessons.reduce((n, l) => n + l.exercises.length, 0);
  check('a module dropped from the export is archived', cycle.archived.ids.join() === 'module-savings', cycle.archived.ids.join());
  check(
    'its lessons and exercises are archived with it',
    cycle.archived.lessons === savingsLessons && cycle.archived.exercises === savingsExercises,
    `${cycle.archived.lessons}/${cycle.archived.exercises}, expected ${savingsLessons}/${savingsExercises}`
  );
  check('bringing it back restores it', cycle.restored.status === 'restored', cycle.restored.status);

  const moved = await inRollback((t) => curriculumService.upsertModule(savings, { source: 'curriculum', sortOrder: savingsIndex + 5 }, t));
  check('moving a module doesn\'t bump its version', moved.status === 'reordered' && moved.version === 1, JSON.stringify(moved));

  const sourceError = await inRollback((t) => expectRejection(curriculumService.upsertModule(savings, { source: 'admin', sortOrder: 0 }, t)));
  check('an admin write can\'t overwrite a curriculum module', sourceError?.message?.includes('already used by a curriculum module'), sourceError?.message ?? 'no error');

  console.log('\nForeign keys protect student records');
  const ava = await User.findOne({ where: { email: 'ava@shana.dev' } });
  check('demo student exists', !!ava);
  if (ava) {
    const fkError = await inRollback((t) => expectRejection(StudentModuleProgress.create({ userId: ava.id, moduleId: 'no-such-module' }, { transaction: t })));
    check('progress for an unknown module is refused', fkError?.name === 'SequelizeForeignKeyConstraintError', fkError?.name ?? 'accepted');

    const bonus = await inRollback((t) => expectRejection(StarLog.create({ userId: ava.id, moduleId: 'module-identity', exerciseId: 'q1__starter', earnedAt: new Date() }, { transaction: t })));
    check('story-tabs bonus star (synthetic exercise id) is still allowed', bonus === null, bonus?.message);
  }
}

async function request(method, url, body, token) {
  const res = await fetch(`${API}${url}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

async function httpChecks() {
  console.log(`\nAPI (${API})`);
  try {
    await fetch(API);
  } catch {
    check('API reachable', false, `start the server first (npm run dev)`);
    return;
  }

  const staffBody = { firstName: 'Mallory', lastName: 'Test', email: `mallory-${Date.now()}@example.com`, password: 'Password123' };
  for (const role of ['admin', 'instructor']) {
    const res = await request('POST', '/api/auth/register', { ...staffBody, role });
    check(`public signup as "${role}" is refused (403)`, res.status === 403, `${res.status} ${res.data.message ?? ''}`);
  }
  check('no staff account was created', (await User.count({ where: { email: staffBody.email } })) === 0);

  const studentEmail = `curriculum-test-${Date.now()}@example.com`;
  const signup = await request('POST', '/api/auth/register', { ...staffBody, email: studentEmail });
  check('public signup as a student still works (201)', signup.status === 201 && signup.data.user?.role === 'student', `${signup.status}`);
  await User.destroy({ where: { email: studentEmail } });

  const demo = [
    ['trainer@shana.dev', 'Trainer123', 'admin'],
    ['coach@shana.dev', 'Coach1234', 'instructor'],
    ['ava@shana.dev', 'Ava12345', 'student'],
    ['leo@shana.dev', 'Leo12345', 'student'],
  ];
  let avaToken = null;
  let adminToken = null;
  const logins = {};
  for (const [email, password, role] of demo) {
    const res = await request('POST', '/api/auth/login', { email, password });
    check(`demo login ${email} → ${role}`, res.status === 200 && res.data.user?.role === role, `${res.status} ${res.data.message ?? res.data.user?.role ?? ''}`);
    logins[email] = res.data.user;
    if (email === 'ava@shana.dev') avaToken = res.data.accessToken;
    if (email === 'trainer@shana.dev') adminToken = res.data.accessToken;
  }

  console.log(`\nProfiles come from the backend`);
  check('Leo\'s login says he is advanced', logins['leo@shana.dev']?.ageGroup === 'advanced', logins['leo@shana.dev']?.ageGroup);
  check('Ava\'s login carries her profile (avatar, welcome seen, streak)',
    logins['ava@shana.dev']?.avatarId === 'zoe' && logins['ava@shana.dev']?.hasSeenWelcome === true && logins['ava@shana.dev']?.streakCount >= 1);
  const today = new Date().toISOString().slice(0, 10);
  check('logging in counts today toward the streak', logins['ava@shana.dev']?.lastActiveDate === today, logins['ava@shana.dev']?.lastActiveDate);
  if (adminToken) {
    const students = await request('GET', '/api/students', null, adminToken);
    const ava = Array.isArray(students.data) ? students.data.find((s) => s.email === 'ava@shana.dev') : null;
    check('admin student list returns real students with their assignments', students.status === 200 && ava?.assignedModuleIds?.length === 24, `${students.status} ${ava?.assignedModuleIds?.length}`);
  }
  if (avaToken) {
    check('students can\'t list other students (403)', (await request('GET', '/api/students', null, avaToken)).status === 403);
    const bad = await request('PUT', '/api/users/me', { hasSeenWelcome: 'yes', avatarId: 'dragon' }, avaToken);
    check('invalid profile updates are rejected (400)', bad.status === 400, `${bad.status}`);
  }
  const badAge = await request('POST', '/api/auth/register', { ...staffBody, email: `badage-${Date.now()}@example.com`, ageGroup: 'toddler' });
  check('signup rejects an unknown age group (400)', badAge.status === 400, `${badAge.status}`);

  if (avaToken) {
    const me = await request('GET', '/api/users/me', null, avaToken);
    const mine = await request('GET', `/api/assignments/${me.data.id}`, null, avaToken);
    check('Ava has her 24 assigned modules', mine.status === 200 && mine.data.moduleIds?.length === 24, `${mine.status} ${mine.data.moduleIds?.length}`);

    const ava = await User.findOne({ where: { email: 'ava@shana.dev' } });
    const hadProgress = await StudentModuleProgress.findOne({ where: { userId: ava.id, moduleId: 'module-identity' } });
    const start = await request('POST', '/api/progress/module-identity/start', {}, avaToken);
    check('existing progress API works with the new foreign keys', start.status === 200 && start.data.moduleId === 'module-identity', `${start.status} ${start.data.message ?? ''}`);
    if (!hadProgress) await StudentModuleProgress.destroy({ where: { userId: ava.id, moduleId: 'module-identity' } });

    const before = {
      progress: await StudentModuleProgress.count({ where: { userId: ava.id } }),
      stars: await StarLog.count({ where: { userId: ava.id } }),
    };
    const bogus = await request('POST', '/api/progress/no-such-module/start', {}, avaToken);
    check('starting an unknown module is a clean 404', bogus.status === 404 && bogus.data.message === 'Module not found', `${bogus.status} ${bogus.data.message ?? ''}`);
    const badLesson = await request('POST', '/api/progress/module-identity/steps/identity-w1-warmup/complete', { lessonId: 'no-such-lesson' }, avaToken);
    check('completing a step in an unknown lesson is a clean 400', badLesson.status === 400, `${badLesson.status} ${badLesson.data.message ?? ''}`);
    const badExercise = await request('POST', '/api/progress/module-identity/steps/no-such-exercise/complete', { lessonId: 'identity-week-1' }, avaToken);
    check('completing an unknown exercise is a clean 400', badExercise.status === 400, `${badExercise.status} ${badExercise.data.message ?? ''}`);
    const badStar = await request('POST', '/api/progress/no-such-module/stars/q1__starter', {}, avaToken);
    check('a star for an unknown module is a clean 404', badStar.status === 404, `${badStar.status}`);
    const after = {
      progress: await StudentModuleProgress.count({ where: { userId: ava.id } }),
      stars: await StarLog.count({ where: { userId: ava.id } }),
    };
    check('none of those wrote anything', after.progress === before.progress && after.stars === before.stars,
      `progress ${before.progress}→${after.progress}, stars ${before.stars}→${after.stars}`);
  }
}

async function run() {
  const exported = JSON.parse(fs.readFileSync(EXPORT_FILE, 'utf8'));
  await dataChecks(exported);
  await behaviourChecks(exported);
  await httpChecks();

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) process.exitCode = 1;
}

run()
  .catch((error) => {
    console.error(`✘ ${error.stack}`);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
