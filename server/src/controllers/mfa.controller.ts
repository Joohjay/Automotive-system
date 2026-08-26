import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import prisma from '../lib/prisma.js';
import { config } from '../config/env.js';
import { parseBody, paramId } from '../utils/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../middleware/error.js';
import { recordAudit } from '../services/audit.service.js';
import { createMfaSecret, encryptSecret, verifyMfaToken } from '../services/mfa.service.js';
import { mfaVerifySchema, mfaSetupSchema } from '../validators/mfa.validator.js';
import { signAccessToken } from '../lib/token.js';
import { getSettings } from '../services/settings.service.js';
import { reconcileStockNotifications } from '../services/notification.service.js';
import {
  AUTH_COOKIE_MAX_AGE,
  AUTH_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  csrfCookieOptions,
  generateCsrfToken,
} from '../middleware/csrf.js';

function clientIp(req: Request): string | undefined {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string') return xff.split(',')[0]?.trim();
  return req.socket.remoteAddress ?? undefined;
}

export const mfaStatus = asyncHandler(async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { mfaEnabled: true },
  });

  res.json({ mfaEnabled: user?.mfaEnabled ?? false });
});

export const mfaSetup = asyncHandler(async (req: Request, res: Response) => {
  const input = parseBody(mfaSetupSchema, req.body);

  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { id: true, email: true, passwordHash: true, mfaEnabled: true },
  });
  if (!user) throw ApiError.notFound('User not found');

  if (user.mfaEnabled) {
    throw ApiError.badRequest('MFA is already enabled. Disable it first before re-setup.');
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) throw ApiError.unauthorized('Invalid password');

  const { secret, uri } = createMfaSecret(user.email);

  await prisma.user.update({
    where: { id: user.id },
    data: { mfaSecret: encryptSecret(secret) },
  });

  await recordAudit({
    userId: user.id,
    branchId: req.user!.branchId,
    action: 'CREATE',
    entityType: 'User',
    entityId: user.id,
    newValue: { type: 'mfa_setup_initiated' },
    ipAddress: clientIp(req),
    userAgent: req.headers['user-agent'],
  });

  res.json({ uri, secret });
});

export const mfaEnable = asyncHandler(async (req: Request, res: Response) => {
  const input = parseBody(mfaVerifySchema, req.body);

  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { id: true, mfaEnabled: true, mfaSecret: true },
  });
  if (!user) throw ApiError.notFound('User not found');
  if (user.mfaEnabled) throw ApiError.badRequest('MFA is already enabled');
  if (!user.mfaSecret) throw ApiError.badRequest('Run MFA setup first to generate a secret');

  const valid = verifyMfaToken(user.mfaSecret, input.token);
  if (!valid) throw ApiError.badRequest('Invalid MFA code. Please try again.');

  await prisma.user.update({
    where: { id: user.id },
    data: { mfaEnabled: true },
  });

  await recordAudit({
    userId: user.id,
    branchId: req.user!.branchId,
    action: 'UPDATE',
    entityType: 'User',
    entityId: user.id,
    newValue: { type: 'mfa_enabled' },
    ipAddress: clientIp(req),
    userAgent: req.headers['user-agent'],
  });

  res.json({ message: 'MFA has been enabled successfully' });
});

export const mfaDisable = asyncHandler(async (req: Request, res: Response) => {
  const input = parseBody(mfaVerifySchema, req.body);

  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { id: true, mfaEnabled: true, mfaSecret: true },
  });
  if (!user) throw ApiError.notFound('User not found');
  if (!user.mfaEnabled) throw ApiError.badRequest('MFA is not enabled');
  if (!user.mfaSecret) throw ApiError.badRequest('MFA secret not found');

  const valid = verifyMfaToken(user.mfaSecret, input.token);
  if (!valid) throw ApiError.badRequest('Invalid MFA code. Please try again.');

  await prisma.user.update({
    where: { id: user.id },
    data: { mfaEnabled: false, mfaSecret: null },
  });

  await recordAudit({
    userId: user.id,
    branchId: req.user!.branchId,
    action: 'UPDATE',
    entityType: 'User',
    entityId: user.id,
    newValue: { type: 'mfa_disabled' },
    ipAddress: clientIp(req),
    userAgent: req.headers['user-agent'],
  });

  res.json({ message: 'MFA has been disabled successfully' });
});

export const mfaLogin = asyncHandler(async (req: Request, res: Response) => {
  const input = parseBody(mfaVerifySchema, req.body);

  const mfaCookie = req.cookies?.autoparts_mfa;
  if (!mfaCookie) throw ApiError.unauthorized('MFA session expired. Please log in again.');

  let payload: { sub: string; purpose: string };
  try {
    payload = jwt.verify(mfaCookie, config.jwt.secret) as { sub: string; purpose: string };
  } catch {
    throw ApiError.unauthorized('MFA session expired. Please log in again.');
  }

  if (payload.purpose !== 'mfa') {
    throw ApiError.unauthorized('Invalid MFA session');
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      email: true,
      fullName: true,
      status: true,
      branchId: true,
      roleId: true,
      mustChangePassword: true,
      mfaEnabled: true,
      mfaSecret: true,
      tokenVersion: true,
      role: {
        select: {
          id: true,
          name: true,
          permissions: { select: { permission: { select: { code: true } } } },
        },
      },
      branch: { select: { id: true, status: true } },
    },
  });
  if (!user) throw ApiError.unauthorized('User not found');
  if (user.status !== 'ACTIVE') throw ApiError.forbidden('Account is not active');
  if (user.branch.status !== 'ACTIVE') throw ApiError.forbidden('Account branch is not active');
  if (!user.mfaEnabled || !user.mfaSecret) {
    throw ApiError.badRequest('MFA is not enabled for this account');
  }

  const valid = verifyMfaToken(user.mfaSecret, input.token);
  if (!valid) throw ApiError.badRequest('Invalid MFA code. Please try again.');

  const authToken = signAccessToken({
    id: user.id,
    email: user.email,
    roleName: user.role.name,
    branchId: user.branchId,
    tokenVersion: user.tokenVersion,
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), failedLoginAttempts: 0, lockedUntil: null },
  });

  res.clearCookie('autoparts_mfa', {
    path: '/',
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
  });
  res.cookie(AUTH_COOKIE_NAME, authToken, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: AUTH_COOKIE_MAX_AGE,
  });

  const csrfToken = generateCsrfToken();
  res.cookie(CSRF_COOKIE_NAME, csrfToken, csrfCookieOptions());

  await recordAudit({
    userId: user.id,
    branchId: user.branchId,
    action: 'LOGIN',
    entityType: 'User',
    entityId: user.id,
    newValue: { method: 'mfa' },
    ipAddress: clientIp(req),
    userAgent: req.headers['user-agent'],
  });

  const settings = await getSettings(user.branchId);
  const permissions = user.role.permissions.map((rp) => rp.permission.code);

  if (user.branchId) {
    void reconcileStockNotifications(user.branchId).catch(() => {});
  }

  res.json({
    mustChangePassword: user.mustChangePassword,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      roleId: user.roleId,
      roleName: user.role.name,
      branchId: user.branchId,
    },
    permissions,
    settings: {
      businessName: settings.businessName,
      currency: settings.currency,
      receiptFooter: settings.receiptFooter,
    },
  });
});
