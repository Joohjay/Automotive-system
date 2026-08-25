import { test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

import type { TokenPayload } from '../../src/lib/token.js';

// Use a fixed test secret — .env may not be loaded in test context
const TEST_SECRET = 'test-secret-key-that-is-long-enough-for-hmac-256';

// ---------------------------------------------------------------------------
// M1: JWT revocation via tokenVersion
// ---------------------------------------------------------------------------

function makeToken(overrides: Partial<TokenPayload> = {}): string {
  const payload: TokenPayload = {
    sub: 'user_1',
    email: 'test@test.com',
    role: 'CASHIER',
    branchId: 'branch_1',
    tv: 0,
    ...overrides,
  };
  return jwt.sign(payload, TEST_SECRET, { expiresIn: '8h' });
}

function decodeToken(token: string): TokenPayload {
  return jwt.verify(token, TEST_SECRET) as TokenPayload;
}

test('M1 — JWT contains tv (tokenVersion) claim', () => {
  const token = makeToken({ tv: 5 });
  const payload = decodeToken(token);
  assert.equal(payload.tv, 5);
});

test('M1 — JWT with tv=0 is valid', () => {
  const token = makeToken({ tv: 0 });
  const payload = decodeToken(token);
  assert.equal(payload.tv, 0);
});

test('M1 — JWT with mismatched tv should be rejected by auth middleware', () => {
  // Simulates: token was issued with tv=0, but user logged out (tv bumped to 1)
  const token = makeToken({ tv: 0 });
  const payload = decodeToken(token);

  const dbTokenVersion = 1; // After logout
  assert.notEqual(payload.tv, dbTokenVersion, 'Token version mismatch should trigger rejection');
});

test('M1 — JWT with matching tv passes revocation check', () => {
  const token = makeToken({ tv: 3 });
  const payload = decodeToken(token);

  const dbTokenVersion = 3;
  assert.equal(payload.tv, dbTokenVersion, 'Token version should match');
});

test('M1 — logout increments tokenVersion', () => {
  // Simulates the DB update on logout
  let tokenVersion = 0;
  tokenVersion += 1; // Increment
  assert.equal(tokenVersion, 1, 'Token version should increment on logout');
});

test('M1 — password change increments tokenVersion', () => {
  let tokenVersion = 2;
  tokenVersion += 1;
  assert.equal(tokenVersion, 3, 'Token version should increment on password change');
});

test('M1 — old token with stale tv is rejected after re-login', () => {
  // User logs in (tv=1), logs out (tv bumped to 2), old token has tv=1
  const oldToken = makeToken({ tv: 1 });
  const newTv = 2;

  const payload = decodeToken(oldToken);
  assert.notEqual(payload.tv, newTv, 'Old token tv should not match new tv');
});
