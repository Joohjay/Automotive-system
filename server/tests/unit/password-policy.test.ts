import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createUserSchema, adminResetPasswordSchema } from '../../src/validators/user.validator.js';
import { changePasswordSchema, loginSchema } from '../../src/validators/auth.validator.js';

test('createUserSchema accepts an 8-char password', () => {
  const parsed = createUserSchema.safeParse({
    email: 'cashier@autoparts.local',
    fullName: 'Cashier',
    roleId: 'role-id',
    branchId: 'branch-id',
    password: 'abcDEF12',
  });
  assert.equal(parsed.success, true);
});

test('createUserSchema rejects passwords shorter than 8 chars', () => {
  const parsed = createUserSchema.safeParse({
    email: 'cashier@autoparts.local',
    fullName: 'Cashier',
    roleId: 'role-id',
    branchId: 'branch-id',
    password: 'short7',
  });
  assert.equal(parsed.success, false);
  if (!parsed.success) {
    assert.match(parsed.error.issues[0].message, /at least 8 characters/);
  }
});

test('changePasswordSchema requires min-8 new password and a current password', () => {
  const ok = changePasswordSchema.safeParse({ currentPassword: 'x', newPassword: 'abcdefgh' });
  assert.equal(ok.success, true);
  const short = changePasswordSchema.safeParse({ currentPassword: 'x', newPassword: 'short7' });
  assert.equal(short.success, false);
  const missingCurrent = changePasswordSchema.safeParse({ newPassword: 'abcdefgh' });
  assert.equal(missingCurrent.success, false);
});

test('adminResetPasswordSchema enforces min-8', () => {
  assert.equal(adminResetPasswordSchema.safeParse({ password: 'abcdefgh' }).success, true);
  assert.equal(adminResetPasswordSchema.safeParse({ password: 'short7' }).success, false);
});

test('loginSchema requires email and password', () => {
  assert.equal(
    loginSchema.safeParse({ email: 'admin@autoparts.local', password: 'anything' }).success,
    true,
  );
  assert.equal(loginSchema.safeParse({ email: 'not-an-email', password: 'x' }).success, false);
  assert.equal(loginSchema.safeParse({}).success, false);
});