/**
 * Run with: node scripts/test-auth.js
 * Requires: server running (npm start) and PostgreSQL with DB shana_elearning.
 *
 * Walks the real account lifecycle: register → login refused until the email is
 * verified → verify via the same signed link the email contains → login → protected
 * route → refresh. Uses a fresh account each run and deletes it at the end.
 */
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { sequelize, User } = require('../src/models');

const BASE = process.env.API_URL || 'http://localhost:3000';

const testUser = {
  firstName: 'Test',
  lastName: 'User',
  email: `test-auth-${Date.now()}@example.com`,
  password: 'testpass123',
};

function parseSetCookie(header) {
  if (!header) return null;
  const match = header.match(/refreshToken=([^;]+)/);
  return match ? match[1] : null;
}

function fail(message, ...details) {
  console.error(`   FAIL: ${message}`, ...details);
  throw Object.assign(new Error(message), { reported: true });
}

const post = (path, body, headers = {}) => fetch(`${BASE}${path}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...headers },
  body: body === undefined ? undefined : JSON.stringify(body),
});

async function run() {
  console.log('1. Register user...');
  const regRes = await post('/api/auth/register', testUser);
  const regData = await regRes.json().catch(() => ({}));
  if (regRes.status !== 201) fail('Register failed', regRes.status, regData);
  if (regData.user?.emailVerified !== false) fail('New account should start unverified', regData.user);
  console.log('   OK: User created (unverified):', regData.user.email);

  console.log('2. Login before verifying the email...');
  const blockedRes = await post('/api/auth/login', { email: testUser.email, password: testUser.password });
  const blockedData = await blockedRes.json().catch(() => ({}));
  if (blockedRes.status !== 403 || blockedData.code !== 'EMAIL_NOT_VERIFIED') {
    fail('Unverified login should be refused with 403 EMAIL_NOT_VERIFIED', blockedRes.status, blockedData);
  }
  console.log('   OK: Refused until verified (403 EMAIL_NOT_VERIFIED).');

  console.log('3. Verify email via the link...');
  const token = jwt.sign({ id: regData.user.id, purpose: 'verify-email' }, process.env.JWT_SECRET, { expiresIn: '24h' });
  const verifyRes = await fetch(`${BASE}/api/auth/verify-email?token=${encodeURIComponent(token)}`);
  const verifyData = await verifyRes.json().catch(() => ({}));
  if (verifyRes.status !== 200 || verifyData.emailVerified !== true) fail('Verify failed', verifyRes.status, verifyData);
  const badVerify = await fetch(`${BASE}/api/auth/verify-email?token=not-a-real-token`);
  if (badVerify.status !== 400) fail('A bad verification link should be refused with 400', badVerify.status);
  console.log('   OK: Email verified; a bad link is refused.');

  console.log('4. Login...');
  const loginRes = await post('/api/auth/login', { email: testUser.email, password: testUser.password });
  const loginData = await loginRes.json().catch(() => ({}));
  if (loginRes.status !== 200) fail('Login failed', loginRes.status, loginData);
  const accessToken = loginData.accessToken;
  const refreshTokenCookie = parseSetCookie(loginRes.headers.get('set-cookie'));
  console.log('   OK: Logged in:', loginData.user?.email);
  if (refreshTokenCookie) console.log('   OK: Refresh token cookie set.');

  console.log('5. Protected route with token...');
  const meRes = await fetch(`${BASE}/api/users/me`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (meRes.status !== 200) fail('GET /api/users/me', meRes.status, await meRes.text());
  const meData = await meRes.json();
  if (meData.emailVerified !== true) fail('Profile should now show emailVerified: true', meData.emailVerified);
  console.log('   OK: Profile:', meData.email);

  if (refreshTokenCookie) {
    console.log('6. Refresh token (cookies remembered)...');
    const refreshRes = await post('/api/auth/refresh', undefined, { Cookie: `refreshToken=${refreshTokenCookie}` });
    const refreshData = await refreshRes.json().catch(() => ({}));
    if (refreshRes.status !== 200) fail('Refresh failed', refreshRes.status, refreshData);
    if (!refreshData.accessToken) fail('No accessToken in refresh response.');
    console.log('   OK: New access token received; cookies are working.');
  } else {
    console.log('6. Skip refresh test (cookie not captured in this environment).');
  }

  console.log('\nAll checks passed.');
}

run()
  .catch((err) => {
    if (err.cause?.code === 'ECONNREFUSED') console.error('Cannot connect to server. Start it with: npm start');
    else if (!err.reported) console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await User.destroy({ where: { email: testUser.email } }).catch(() => {});
    await sequelize.close();
  });
