import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertCanManageAdminAccount } from '../../src/services/admin-guard.service.js';

test('OWNER may manage admin accounts', () => {
  assert.doesNotThrow(() => assertCanManageAdminAccount('OWNER', 'OWNER'));
  assert.doesNotThrow(() => assertCanManageAdminAccount('OWNER', 'ADMIN'));
  assert.doesNotThrow(() => assertCanManageAdminAccount('OWNER', 'MANAGER'));
});

test('ADMIN may manage staff but not admin accounts', () => {
  assert.doesNotThrow(() => assertCanManageAdminAccount('ADMIN', 'MANAGER'));
  assert.doesNotThrow(() => assertCanManageAdminAccount('ADMIN', 'CASHIER'));
  assert.throws(() => assertCanManageAdminAccount('ADMIN', 'OWNER'), /OWNER/);
  assert.throws(() => assertCanManageAdminAccount('ADMIN', 'ADMIN'), /OWNER/);
});

test('MANAGER may only manage below-admin staff', () => {
  assert.doesNotThrow(() => assertCanManageAdminAccount('MANAGER', 'CASHIER'));
  assert.throws(() => assertCanManageAdminAccount('MANAGER', 'ADMIN'), /OWNER/);
  assert.throws(() => assertCanManageAdminAccount('MANAGER', 'OWNER'), /OWNER/);
});

test('null/undefined target role is not an escalation target', () => {
  assert.doesNotThrow(() => assertCanManageAdminAccount('ADMIN', null));
  assert.doesNotThrow(() => assertCanManageAdminAccount('CASHIER', undefined));
});