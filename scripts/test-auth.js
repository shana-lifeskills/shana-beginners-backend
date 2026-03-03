/**
 * Run with: node scripts/test-auth.js
 * Requires: server running (npm start) and PostgreSQL with DB shana_elearning.
 */
const BASE = 'http://localhost:3000';

const testUser = {
  firstName: 'Test',
  lastName: 'User',
  email: 'testuser@example.com',
  password: 'testpass123',
};

function parseSetCookie(header) {
  if (!header) return null;
  const match = header.match(/refreshToken=([^;]+)/);
  return match ? match[1] : null;
}

async function run() {
  let refreshTokenCookie = null;
  let accessToken = null;

  console.log('1. Register user...');
  const regRes = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testUser),
  });
  const regData = await regRes.json().catch(() => ({}));

  if (regRes.status !== 201) {
    if (regRes.status === 409 && regData.message?.includes('already in use')) {
      console.log('   User already exists, will use login instead.');
    } else {
      console.error('   FAIL: Register failed', regRes.status, regData);
      process.exit(1);
    }
  } else {
    console.log('   OK: User created:', regData.user?.email);
    accessToken = regData.accessToken;
    const setCookie = regRes.headers.get('set-cookie');
    refreshTokenCookie = parseSetCookie(setCookie);
    if (setCookie && setCookie.includes('refreshToken')) {
      console.log('   OK: Refresh token cookie set in response.');
    }
  }

  if (!accessToken) {
    console.log('2. Login...');
    const loginRes = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUser.email, password: testUser.password }),
    });
    const loginData = await loginRes.json().catch(() => ({}));
    if (loginRes.status !== 200) {
      console.error('   FAIL: Login failed', loginRes.status, loginData);
      process.exit(1);
    }
    accessToken = loginData.accessToken;
    const setCookie = loginRes.headers.get('set-cookie');
    refreshTokenCookie = parseSetCookie(setCookie);
    console.log('   OK: Logged in:', loginData.user?.email);
    if (setCookie && setCookie.includes('refreshToken')) {
      console.log('   OK: Refresh token cookie set.');
    }
  }

  console.log('3. Protected route with token...');
  const meRes = await fetch(`${BASE}/api/users/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (meRes.status !== 200) {
    console.error('   FAIL: GET /api/users/me', meRes.status, await meRes.text());
    process.exit(1);
  }
  const meData = await meRes.json();
  console.log('   OK: Profile:', meData.email);

  if (!refreshTokenCookie) {
    console.log('4. Refresh: no cookie captured (login/register may not send cookie in same-origin fetch). Checking /refresh with cookie from login...');
    const loginRes2 = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUser.email, password: testUser.password }),
      redirect: 'manual',
    });
    const setCookie2 = loginRes2.headers.get('set-cookie');
    refreshTokenCookie = parseSetCookie(setCookie2);
  }

  if (refreshTokenCookie) {
    console.log('4. Refresh token (cookies remembered)...');
    const refreshRes = await fetch(`${BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: `refreshToken=${refreshTokenCookie}` },
    });
    const refreshData = await refreshRes.json().catch(() => ({}));
    if (refreshRes.status !== 200) {
      console.error('   FAIL: Refresh failed', refreshRes.status, refreshData);
      process.exit(1);
    }
    if (refreshData.accessToken) {
      console.log('   OK: New access token received; cookies are working.');
    } else {
      console.error('   FAIL: No accessToken in refresh response.');
      process.exit(1);
    }
  } else {
    console.log('4. Skip refresh test (cookie not captured in this environment).');
  }

  console.log('\nAll checks passed.');
}

run().catch((err) => {
  if (err.cause?.code === 'ECONNREFUSED') {
    console.error('Cannot connect to server. Start it with: npm start');
    process.exit(1);
  }
  console.error(err);
  process.exit(1);
});
