/**
 * Automated test for the Modules, Lessons, Progress & Gamification system.
 *
 * Run with:  node scripts/test-modules.js
 * Requires:  server running (npm start) and PostgreSQL with migrations applied.
 *
 * This script will:
 *   1. Register/login an admin and a student
 *   2. Promote the admin user in-app (via direct DB update fallback)
 *   3. Create a module with lessons
 *   4. Enroll the student
 *   5. Test sequential lesson unlocking
 *   6. Complete lessons and verify progress aggregation
 *   7. Verify achievement caps
 *   8. Check stats and progress summary
 *   9. Clean up test data
 */

const BASE = 'http://localhost:3000';

const adminUser = {
  firstName: 'TestAdmin',
  lastName: 'Modules',
  email: `testadmin_mod_${Date.now()}@shana.com`,
  password: 'Admin1234',
};

const studentUser = {
  firstName: 'TestStudent',
  lastName: 'Modules',
  email: `teststudent_mod_${Date.now()}@shana.com`,
  password: 'Student1234',
};

let adminToken = null;
let adminId = null;
let studentToken = null;
let studentId = null;
let moduleId = null;
let lesson1Id = null;
let lesson2Id = null;
let lesson3Id = null;

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`   ✅ ${label}`);
    passed++;
  } else {
    console.error(`   ❌ FAIL: ${label}`);
    failed++;
  }
}

async function api(method, path, body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function run() {
  // ─── 1. Register admin ───
  console.log('\n1. Register admin user...');
  let res = await api('POST', '/api/auth/register', adminUser);
  if (res.status === 201) {
    adminToken = res.data.accessToken;
    adminId = res.data.user.id;
    assert(true, 'Admin registered');
    assert(res.data.user.stars === 0, 'Admin has stars=0 in response');
    assert(res.data.user.badges === 0, 'Admin has badges=0 in response');
    assert(res.data.user.trophies === 0, 'Admin has trophies=0 in response');
    assert(res.data.user.modulesCompleted === 0, 'Admin has modulesCompleted=0 in response');
  } else {
    console.error('   Cannot register admin:', res.data);
    process.exit(1);
  }

  // Promote to admin via a direct DB call through a workaround:
  // We'll use the sequelize models directly since we're in the same project
  console.log('\n2. Promote admin user...');
  const { User } = require('../src/models');
  await User.update({ role: 'admin' }, { where: { id: adminId } });
  // Re-login to get a token with the admin role
  res = await api('POST', '/api/auth/login', {
    email: adminUser.email,
    password: adminUser.password,
  });
  adminToken = res.data.accessToken;
  assert(res.status === 200, 'Admin re-logged in with admin role');

  // ─── 3. Register student ───
  console.log('\n3. Register student user...');
  res = await api('POST', '/api/auth/register', studentUser);
  assert(res.status === 201, 'Student registered');
  studentToken = res.data.accessToken;
  studentId = res.data.user.id;

  // ─── 4. Create a module ───
  console.log('\n4. Create a module...');
  res = await api('POST', '/api/modules', {
    title: 'Test Module: Respect',
    description: 'Learn about respect and empathy',
    icon: 'respect-icon',
    difficulty: 'beginner',
    published: true,
    totalStars: 25,
    totalBadges: 8,
    totalTrophies: 3,
  }, adminToken);
  assert(res.status === 201, 'Module created');
  assert(res.data.title === 'Test Module: Respect', 'Module title matches');
  moduleId = res.data.id;

  // ─── 5. Create lessons ───
  console.log('\n5. Create lessons in module...');
  res = await api('POST', `/api/modules/${moduleId}/lessons`, {
    title: 'Lesson 1: What is Respect?',
    order: 0,
    weekNumber: 1,
    totalStars: 5,
    totalBadges: 2,
    totalTrophies: 1,
  }, adminToken);
  assert(res.status === 201, 'Lesson 1 created');
  lesson1Id = res.data.id;

  res = await api('POST', `/api/modules/${moduleId}/lessons`, {
    title: 'Lesson 2: Respect in Action',
    order: 1,
    weekNumber: 1,
    totalStars: 10,
    totalBadges: 3,
    totalTrophies: 1,
  }, adminToken);
  assert(res.status === 201, 'Lesson 2 created');
  lesson2Id = res.data.id;

  res = await api('POST', `/api/modules/${moduleId}/lessons`, {
    title: 'Lesson 3: Respect Review',
    order: 2,
    weekNumber: 2,
    totalStars: 10,
    totalBadges: 3,
    totalTrophies: 1,
  }, adminToken);
  assert(res.status === 201, 'Lesson 3 created');
  lesson3Id = res.data.id;

  // Verify totalLessons was updated on the module
  res = await api('GET', `/api/modules/${moduleId}`);
  assert(res.data.totalLessons === 3, `Module totalLessons = 3 (got ${res.data.totalLessons})`);

  // ─── 6. List modules and lessons ───
  console.log('\n6. Verify listing endpoints...');
  res = await api('GET', '/api/modules');
  assert(res.status === 200, 'GET /api/modules returns 200');
  assert(Array.isArray(res.data), 'Modules response is an array');

  res = await api('GET', `/api/modules/${moduleId}/lessons`);
  assert(res.status === 200, 'GET /api/modules/:id/lessons returns 200');
  assert(res.data.length === 3, `Module has 3 lessons (got ${res.data.length})`);

  res = await api('GET', `/api/lessons/${lesson1Id}`);
  assert(res.status === 200, 'GET /api/lessons/:id returns 200');
  assert(res.data.title === 'Lesson 1: What is Respect?', 'Lesson title matches');

  // ─── 7. Enroll student ───
  console.log('\n7. Enroll student in module...');
  res = await api('POST', `/api/modules/${moduleId}/enroll`, null, studentToken);
  assert(res.status === 200, 'Student enrolled successfully');

  // Verify enrollment appears
  res = await api('GET', `/api/students/${studentId}/modules`, null, studentToken);
  assert(res.status === 200, 'GET student modules returns 200');
  assert(res.data.length >= 1, 'Student has at least 1 module');

  // ─── 8. Test sequential unlocking ───
  console.log('\n8. Test sequential lesson unlocking...');

  // Try to complete lesson 2 (order=1) before lesson 1 (order=0) — should fail
  res = await api('PUT', `/api/students/${studentId}/lessons/${lesson2Id}`, {
    progress: 100,
    starsEarned: 5,
    badgesEarned: 1,
    trophiesEarned: 0,
  }, studentToken);
  assert(res.status === 422, `Skipping lesson blocked (status=${res.status})`);

  // ─── 9. Test achievement caps ───
  console.log('\n9. Test achievement caps...');

  // Try to earn more stars than the lesson allows
  res = await api('PUT', `/api/students/${studentId}/lessons/${lesson1Id}`, {
    progress: 100,
    starsEarned: 999,
    badgesEarned: 0,
    trophiesEarned: 0,
  }, studentToken);
  assert(res.status === 400, `Stars cap enforced (status=${res.status})`);

  // Try to earn more badges than allowed
  res = await api('PUT', `/api/students/${studentId}/lessons/${lesson1Id}`, {
    progress: 100,
    starsEarned: 0,
    badgesEarned: 999,
    trophiesEarned: 0,
  }, studentToken);
  assert(res.status === 400, `Badges cap enforced (status=${res.status})`);

  // ─── 10. Complete lesson 1 ───
  console.log('\n10. Complete lesson 1...');
  res = await api('PUT', `/api/students/${studentId}/lessons/${lesson1Id}`, {
    progress: 100,
    starsEarned: 5,
    badgesEarned: 2,
    trophiesEarned: 1,
  }, studentToken);
  assert(res.status === 200, 'Lesson 1 completed');
  assert(res.data.status === 'completed', `Lesson status = completed (got ${res.data.status})`);

  // ─── 11. Complete lesson 2 (now allowed) ───
  console.log('\n11. Complete lesson 2 (sequential unlock verified)...');
  res = await api('PUT', `/api/students/${studentId}/lessons/${lesson2Id}`, {
    progress: 100,
    starsEarned: 8,
    badgesEarned: 3,
    trophiesEarned: 1,
  }, studentToken);
  assert(res.status === 200, 'Lesson 2 completed (after lesson 1)');
  assert(res.data.status === 'completed', `Lesson 2 status = completed (got ${res.data.status})`);

  // ─── 12. Partial progress on lesson 3 ───
  console.log('\n12. Partial progress on lesson 3...');
  res = await api('PUT', `/api/students/${studentId}/lessons/${lesson3Id}`, {
    progress: 50,
    starsEarned: 3,
    badgesEarned: 1,
    trophiesEarned: 0,
  }, studentToken);
  assert(res.status === 200, 'Lesson 3 partial progress saved');
  assert(res.data.status === 'in-progress', `Lesson 3 status = in-progress (got ${res.data.status})`);

  // ─── 13. Check progress summary ───
  console.log('\n13. Check progress summary...');
  res = await api('GET', `/api/students/${studentId}/progress/summary`, null, studentToken);
  assert(res.status === 200, 'Progress summary returned');
  assert(res.data.stats.totalAssigned === 1, `totalAssigned = 1 (got ${res.data.stats.totalAssigned})`);
  assert(res.data.stats.totalInProgress === 1, `totalInProgress = 1 (got ${res.data.stats.totalInProgress})`);
  assert(res.data.modules.length === 1, 'Summary contains 1 module');
  assert(res.data.modules[0].lessons.length === 3, 'Module has 3 lessons in summary');

  // ─── 14. Complete lesson 3 → module should be completed ───
  console.log('\n14. Complete lesson 3 → module completion...');
  res = await api('PUT', `/api/students/${studentId}/lessons/${lesson3Id}`, {
    progress: 100,
    starsEarned: 10,
    badgesEarned: 3,
    trophiesEarned: 1,
  }, studentToken);
  assert(res.status === 200, 'Lesson 3 completed');

  // Check module enrollment status
  res = await api('GET', `/api/students/${studentId}/modules`, null, studentToken);
  const enrollment = res.data.find((e) => e.moduleId === moduleId);
  assert(enrollment.status === 'completed', `Module status = completed (got ${enrollment?.status})`);
  assert(enrollment.progressPercent === 100, `Module progress = 100% (got ${enrollment?.progressPercent})`);
  assert(enrollment.starsEarned === 23, `Module starsEarned = 23 (got ${enrollment?.starsEarned})`);
  assert(enrollment.badgesEarned === 8, `Module badgesEarned = 8 (got ${enrollment?.badgesEarned})`);
  assert(enrollment.trophiesEarned === 3, `Module trophiesEarned = 3 (got ${enrollment?.trophiesEarned})`);

  // ─── 15. Check student stats ───
  console.log('\n15. Check student stats...');
  res = await api('GET', `/api/students/${studentId}/stats`, null, studentToken);
  assert(res.status === 200, 'Student stats returned');
  assert(res.data.stars === 23, `User stars = 23 (got ${res.data.stars})`);
  assert(res.data.badges === 8, `User badges = 8 (got ${res.data.badges})`);
  assert(res.data.trophies === 3, `User trophies = 3 (got ${res.data.trophies})`);
  assert(res.data.modulesCompleted === 1, `User modulesCompleted = 1 (got ${res.data.modulesCompleted})`);
  assert(res.data.totalCompleted === 1, `totalCompleted = 1 (got ${res.data.totalCompleted})`);

  // ─── 16. Check /users/me includes gamification fields ───
  console.log('\n16. Check /users/me gamification fields...');
  res = await api('GET', '/api/users/me', null, studentToken);
  assert(res.data.stars === 23, `GET /users/me stars = 23 (got ${res.data.stars})`);
  assert(res.data.modulesCompleted === 1, `GET /users/me modulesCompleted = 1 (got ${res.data.modulesCompleted})`);

  // ─── 17. Test student listing (admin only) ───
  console.log('\n17. Test student listing...');
  res = await api('GET', '/api/students', null, adminToken);
  assert(res.status === 200, 'Admin can list students');
  const ourStudent = res.data.find((s) => s.id === studentId);
  assert(ourStudent !== undefined, 'Test student appears in list');

  // Student cannot list all students
  res = await api('GET', '/api/students', null, studentToken);
  assert(res.status === 403, `Student blocked from listing students (status=${res.status})`);

  // ─── 18. Test module students endpoint ───
  console.log('\n18. Test module enrolled students...');
  res = await api('GET', `/api/modules/${moduleId}/students`, null, adminToken);
  assert(res.status === 200, 'Admin can see enrolled students');
  assert(res.data.length >= 1, 'At least 1 student enrolled');

  // ─── 19. Test progress validation ───
  console.log('\n19. Test progress validation...');
  res = await api('PUT', `/api/students/${studentId}/lessons/${lesson1Id}`, {
    progress: 150,
  }, studentToken);
  assert(res.status === 400, `Progress > 100 rejected (status=${res.status})`);

  res = await api('PUT', `/api/students/${studentId}/lessons/${lesson1Id}`, {}, studentToken);
  assert(res.status === 400, `Missing progress rejected (status=${res.status})`);

  // ─── 20. Test update & delete module (admin) ───
  console.log('\n20. Test module update...');
  res = await api('PUT', `/api/modules/${moduleId}`, {
    title: 'Updated Module: Respect',
    description: 'Updated description',
  }, adminToken);
  assert(res.status === 200, 'Module updated');
  assert(res.data.title === 'Updated Module: Respect', 'Module title updated');

  // ─── 21. Test lesson update ───
  console.log('\n21. Test lesson update...');
  res = await api('PUT', `/api/lessons/${lesson1Id}`, {
    title: 'Updated Lesson 1',
  }, adminToken);
  assert(res.status === 200, 'Lesson updated');
  assert(res.data.title === 'Updated Lesson 1', 'Lesson title updated');

  // ─── Cleanup ───
  const skipCleanup = process.argv.includes('--no-cleanup');
  if (skipCleanup) {
    console.log('\n22. Skipping cleanup (--no-cleanup flag set).');
    console.log(`   Admin:   ${adminId} (${adminUser.email})`);
    console.log(`   Student: ${studentId} (${studentUser.email})`);
    console.log(`   Module:  ${moduleId}`);
    console.log(`   Lessons: ${lesson1Id}, ${lesson2Id}, ${lesson3Id}`);
  } else {
    console.log('\n22. Cleanup test data...');
    await api('DELETE', `/api/modules/${moduleId}`, null, adminToken);
    await User.destroy({ where: { id: adminId } });
    await User.destroy({ where: { id: studentId } });
    console.log('   Cleaned up.');
  }

  // Close DB connection
  const { sequelize } = require('../src/models');
  await sequelize.close();

  // ─── Summary ───
  console.log('\n════════════════════════════════════');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('════════════════════════════════════\n');

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  if (err.cause?.code === 'ECONNREFUSED') {
    console.error('Cannot connect to server. Start it with: npm start');
    process.exit(1);
  }
  console.error('Unexpected error:', err);
  process.exit(1);
});
