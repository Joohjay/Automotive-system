import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { PrismaClient } from '@prisma/client';

const require = createRequire(import.meta.url);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.resolve(__dirname, '..');

const PORT = 43101;
const BASE = `http://127.0.0.1:${PORT}/api`;
const TEST_JWT = 'test-only-jwt-secret-0123456789abcdef-0123456789abcdef';

let server;
let prisma;
let roleIds = {};
let ownerId;
let branchId;
let ownerJar = {};
let adminJar = {};
let managerJar = {};
let cashierJar = {};

function testDbUrl() {
  const dotenv = require('dotenv');
  dotenv.config({ path: path.join(SERVER_DIR, '.env') });
  const url = process.env.DATABASE_URL;
  return url.replace(/\/[^/?#]+(\?.*)?$/, '/autoparts_test$1');
}

function extractCookie(setCookies, name) {
  for (const c of setCookies ?? []) {
    const m = c.match(new RegExp(`^${name}=([^;]+)`));
    if (m) return m[1];
  }
  return null;
}

async function startServer() {
  server = spawn(process.execPath, ['dist/index.js'], {
    cwd: SERVER_DIR,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(PORT),
      DATABASE_URL: testDbUrl(),
      JWT_SECRET: TEST_JWT,
      AUTH_LOGIN_LIMIT: '100',
      AUTH_GLOBAL_LIMIT: '2000',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', () => {});
  server.stderr.on('data', () => {});
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/api/health`);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('server did not become ready');
}

async function getCsrf(jar) {
  const res = await fetch(`${BASE}/auth/csrf`, { credentials: 'include' });
  const body = await res.json();
  jar.csrfToken = body.csrfToken;
  const cookie = extractCookie(res.headers.getSetCookie?.() ?? [], 'autoparts_csrf');
  jar.csrfCookie = cookie ? `autoparts_csrf=${cookie}` : '';
  return { status: res.status };
}

async function login(email, password, jar) {
  await getCsrf(jar);
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-csrf-token': jar.csrfToken,
      cookie: jar.csrfCookie,
    },
    body: JSON.stringify({ email, password }),
    credentials: 'include',
  });
  const body = await res.json();
  const token = extractCookie(res.headers.getSetCookie?.() ?? [], 'autoparts_token');
  jar.authCookie = token ? `autoparts_token=${token}; ${jar.csrfCookie}` : jar.csrfCookie;
  return { status: res.status, body };
}

async function api(path, { method = 'GET', body, jar = {}, withCsrf = true } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (jar.authCookie) headers.cookie = jar.authCookie;
  if (jar.csrfCookie && withCsrf) headers['x-csrf-token'] = jar.csrfToken;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });
  let data = null;
  try {
    data = await res.json();
  } catch {}
  return { status: res.status, data };
}

async function createUserVia(jar, { email, password, fullName, roleId }) {
  const res = await api('/users', {
    method: 'POST',
    jar,
    body: { email, password, fullName, roleId, branchId },
  });
  return res;
}

before(async () => {
  await startServer();
  process.env.DATABASE_URL = testDbUrl();
  prisma = new PrismaClient();
  const roles = await prisma.role.findMany();
  roleIds = Object.fromEntries(roles.map((r) => [r.name, r.id]));
  const owner = await prisma.user.findUnique({ where: { email: 'admin@autoparts.local' } });
  ownerId = owner.id;
  branchId = (await prisma.branch.findFirst()).id;
  await prisma.user.deleteMany({
    where: { email: { in: ['admin2@autoparts.local', 'admin3@autoparts.local', 'manager@autoparts.local', 'cashier@autoparts.local'] } },
  });
});

after(async () => {
  if (prisma) await prisma.$disconnect();
  if (server) server.kill('SIGTERM');
});

test('health endpoint reachable', async () => {
  const res = await fetch(`http://127.0.0.1:${PORT}/api/health`);
  assert.equal(res.status, 200);
});

test('CSRF token endpoint sets cookie and returns token', async () => {
  const jar = {};
  const { status } = await getCsrf(jar);
  assert.equal(status, 200);
  assert.ok(jar.csrfToken);
  assert.ok(jar.csrfCookie);
});

test('login succeeds and sets auth cookie', async () => {
  const res = await login('admin@autoparts.local', 'Admin@12345', ownerJar);
  assert.equal(res.status, 200);
  assert.ok(ownerJar.authCookie);
  // L3: JWT token must NOT be in response body — it's in the httpOnly cookie
  assert.equal(res.body.token, undefined, 'token must not be in response body');
  assert.ok(res.body.user, 'response must include user info');
});

test('login with wrong password returns generic 401', async () => {
  const jar = {};
  const res = await login('admin@autoparts.local', 'definitely-wrong', jar);
  assert.equal(res.status, 401);
  assert.match(res.body?.error?.message ?? '', /Invalid email or password/);
});

test('unknown email returns generic 401 (no enumeration)', async () => {
  const jar = {};
  const res = await login('nobody@example.com', 'whatever123', jar);
  assert.equal(res.status, 401);
  assert.match(res.body?.error?.message ?? '', /Invalid email or password/);
});

test('unauthenticated request is rejected', async () => {
  const res = await api('/auth/me', { jar: {} });
  assert.equal(res.status, 401);
});

test('state-changing request without CSRF header is rejected', async () => {
  const jar = {};
  await login('admin@autoparts.local', 'Admin@12345', jar);
  const res = await api('/auth/logout', { method: 'POST', jar, withCsrf: false });
  assert.equal(res.status, 403);
});

test('OWNER can list users', async () => {
  const res = await api('/users', { jar: ownerJar });
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.data?.data));
});

test('OWNER creates an ADMIN user', async () => {
  const res = await createUserVia(ownerJar, {
    email: 'admin2@autoparts.local',
    password: 'Admin2@12345',
    fullName: 'Second Admin',
    roleId: roleIds['ADMIN'],
  });
  assert.equal(res.status, 201);
});

test('new ADMIN can log in', async () => {
  const res = await login('admin2@autoparts.local', 'Admin2@12345', adminJar);
  assert.equal(res.status, 200);
});

test('ADMIN can list users (has user.view)', async () => {
  const res = await api('/users', { jar: adminJar });
  assert.equal(res.status, 200);
});

test('ADMIN cannot reset the OWNER password (privilege escalation blocked)', async () => {
  const res = await api(`/users/${ownerId}/password-reset`, {
    method: 'POST',
    jar: adminJar,
    body: { password: 'Stolen@12345' },
  });
  assert.equal(res.status, 403);
});

test('ADMIN cannot reassign the OWNER role (privilege escalation blocked)', async () => {
  const res = await api(`/users/${ownerId}/role`, {
    method: 'PATCH',
    jar: adminJar,
    body: { roleId: roleIds['MANAGER'] },
  });
  assert.equal(res.status, 403);
});

test('ADMIN cannot self-promote to OWNER', async () => {
  const adminUser = await prisma.user.findUnique({ where: { email: 'admin2@autoparts.local' } });
  const res = await api(`/users/${adminUser.id}/role`, {
    method: 'PATCH',
    jar: adminJar,
    body: { roleId: roleIds['OWNER'] },
  });
  assert.equal(res.status, 403);
});

test('ADMIN cannot create another ADMIN user', async () => {
  const res = await createUserVia(adminJar, {
    email: 'admin3@autoparts.local',
    password: 'Admin3@12345',
    fullName: 'Third Admin',
    roleId: roleIds['ADMIN'],
  });
  assert.equal(res.status, 403);
});

test('ADMIN can create a MANAGER (staff management allowed)', async () => {
  const res = await createUserVia(adminJar, {
    email: 'manager@autoparts.local',
    password: 'Manager@12345',
    fullName: 'Branch Manager',
    roleId: roleIds['MANAGER'],
  });
  assert.equal(res.status, 201);
});

test('OWNER can still demote an ADMIN (OWNER retains full power)', async () => {
  const adminUser = await prisma.user.findUnique({ where: { email: 'admin2@autoparts.local' } });
  const res = await api(`/users/${adminUser.id}/role`, {
    method: 'PATCH',
    jar: ownerJar,
    body: { roleId: roleIds['MANAGER'] },
  });
  assert.equal(res.status, 200);
});

test('MANAGER cannot access user administration', async () => {
  await login('manager@autoparts.local', 'Manager@12345', managerJar);
  const res = await api('/users', { jar: managerJar });
  assert.equal(res.status, 403);
});

test('MANAGER can view products (open authenticated route)', async () => {
  const res = await api('/products', { jar: managerJar });
  assert.equal(res.status, 200);
});

test('account locks after repeated failures', async () => {
  const created = await createUserVia(ownerJar, {
    email: 'cashier@autoparts.local',
    password: 'Cashier@12345',
    fullName: 'Cashier',
    roleId: roleIds['CASHIER'],
  });
  assert.equal(created.status, 201);
  const cashier = await prisma.user.findUnique({ where: { email: 'cashier@autoparts.local' } });

  const jar = {};
  for (let i = 0; i < 5; i++) {
    const res = await login('cashier@autoparts.local', 'wrongpass', jar);
    assert.equal(res.status, 401);
  }
  const lockedUser = await prisma.user.findUnique({ where: { id: cashier.id } });
  assert.ok(lockedUser.lockedUntil && lockedUser.lockedUntil > new Date());

  const res = await login('cashier@autoparts.local', 'Cashier@12345', cashierJar);
  assert.equal(res.status, 401, 'correct password must be rejected while locked');
});

test('forgot-password gives generic message for unknown email', async () => {
  const jar = {};
  await getCsrf(jar);
  const res = await api('/auth/forgot-password', {
    method: 'POST',
    jar,
    body: { email: 'does-not-exist@example.com' },
  });
  assert.equal(res.status, 200);
  assert.match(res.data?.message ?? '', /reset link has been sent/);
});

test('change-password rejects wrong current password', async () => {
  const res = await api('/auth/change-password', {
    method: 'POST',
    jar: ownerJar,
    body: { currentPassword: 'wrong', newPassword: 'BrandNew@12345' },
  });
  assert.equal(res.status, 400);
});

// ---------------------------------------------------------------------------
// M1: JWT revocation — logout invalidates old tokens
// ---------------------------------------------------------------------------
test('M1 — logout invalidates the old session', async () => {
  // Capture the old cookie before logout
  const oldCookie = ownerJar.authCookie;
  // Logout
  const logoutRes = await api('/auth/logout', { method: 'POST', jar: ownerJar });
  assert.equal(logoutRes.status, 204);

  // Try using the old cookie — should be rejected
  const staleRes = await api('/auth/me', {
    jar: { authCookie: oldCookie, csrfCookie: '', csrfToken: '' },
  });
  assert.equal(staleRes.status, 401, 'old session should be rejected after logout');
});

test('M1 — re-login works after logout (new tokenVersion)', async () => {
  // Re-login to get a fresh token
  const res = await login('admin@autoparts.local', 'Admin@12345', ownerJar);
  assert.equal(res.status, 200);
  assert.ok(ownerJar.authCookie);
});

// ---------------------------------------------------------------------------
// M5: statement_timeout — slow queries are terminated
// ---------------------------------------------------------------------------
test('M5 — health endpoint still responds quickly (statement_timeout active)', async () => {
  const start = Date.now();
  const res = await fetch(`http://127.0.0.1:${PORT}/api/health`);
  const elapsed = Date.now() - start;
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.database, 'up');
  assert.ok(elapsed < 5000, `health check took ${elapsed}ms — should be under 5s`);
});

// ---------------------------------------------------------------------------
// H7: server timeout — verify server is responsive
// ---------------------------------------------------------------------------
test('H7 — server responds within timeout window', async () => {
  const start = Date.now();
  const res = await fetch(`http://127.0.0.1:${PORT}/api/health`);
  const elapsed = Date.now() - start;
  assert.equal(res.status, 200);
  assert.ok(elapsed < 30000, 'server must respond within 30s timeout');
});

// ---------------------------------------------------------------------------
// L1: unified reset password error messages
// ---------------------------------------------------------------------------
test('L1 — forgot-password returns same message for known and unknown emails', async () => {
  const jar1 = {};
  await getCsrf(jar1);
  const res1 = await api('/auth/forgot-password', {
    method: 'POST',
    jar: jar1,
    body: { email: 'admin@autoparts.local' },
  });

  const jar2 = {};
  await getCsrf(jar2);
  const res2 = await api('/auth/forgot-password', {
    method: 'POST',
    jar: jar2,
    body: { email: 'nonexistent@example.com' },
  });

  assert.equal(res1.status, 200);
  assert.equal(res2.status, 200);
  // Both should return identical message — no enumeration possible
  assert.equal(res1.data?.message, res2.data?.message);
});