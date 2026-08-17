import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';

import prisma from '../lib/prisma.js';
import { signAccessToken, toAuthUser } from '../lib/token.js';
import { ApiError } from '../middleware/error.js';
import { recordAudit } from '../services/audit.service.js';
import { getSettings } from '../services/settings.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { parseBody } from '../utils/validate.js';
import { loginSchema } from '../validators/auth.validator.js';

function clientIp(req: Request): string | undefined {
  return req.ip ?? req.headers['x-forwarded-for']?.toString();
}

export const login = asyncHandler(async (req: Request, res: Response) => {
  const input = parseBody(loginSchema, req.body);

  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
    select: {
      id: true,
      email: true,
      fullName: true,
      passwordHash: true,
      status: true,
      branchId: true,
      roleId: true,
      role: {
        select: { name: true, permissions: { select: { permission: { select: { code: true } } } } },
      },
      branch: { select: { status: true, name: true } },
    },
  });

  const invalid = () =>
    ApiError.unauthorized('Invalid email or password');

  if (!user) throw invalid();
  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) throw invalid();

  if (user.status !== 'ACTIVE') {
    throw ApiError.forbidden('This account is not active. Contact the administrator.');
  }
  if (user.branch.status !== 'ACTIVE') {
    throw ApiError.forbidden('This account branch is not active.');
  }

  const token = signAccessToken({
    id: user.id,
    email: user.email,
    roleName: user.role.name,
    branchId: user.branchId,
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await recordAudit({
    userId: user.id,
    branchId: user.branchId,
    action: 'LOGIN',
    entityType: 'User',
    entityId: user.id,
    ipAddress: clientIp(req),
    userAgent: req.headers['user-agent'],
  });

  const settings = await getSettings(user.branchId);

  res.json({
    token,
    user: toAuthUser({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      roleId: user.roleId,
      role: user.role,
      branchId: user.branchId,
      permissions: user.role.permissions.map((rp) => rp.permission.code),
    }),
    settings: {
      businessName: settings.businessName ?? 'Blax Enterprises',
      currency: settings.currency ?? 'TZS',
      receiptFooter: settings.receiptFooter ?? '',
    },
  });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: {
      id: true,
      email: true,
      fullName: true,
      phone: true,
      status: true,
      lastLoginAt: true,
      branchId: true,
      roleId: true,
      branch: { select: { name: true, code: true } },
      role: { select: { name: true, permissions: { select: { permission: { select: { code: true } } } } } },
    },
  });
  if (!user) throw ApiError.notFound('User not found');

  const settings = await getSettings(user.branchId);

  res.json({
    user: toAuthUser({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      roleId: user.roleId,
      role: user.role,
      branchId: user.branchId,
      permissions: user.role.permissions.map((rp) => rp.permission.code),
    }),
    lastLoginAt: user.lastLoginAt,
    branchName: user.branch.name,
    settings: {
      businessName: settings.businessName ?? 'Blax Enterprises',
      currency: settings.currency ?? 'TZS',
      receiptFooter: settings.receiptFooter ?? '',
    },
  });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  if (req.user) {
    await recordAudit({
      userId: req.user.id,
      branchId: req.user.branchId,
      action: 'LOGOUT',
      entityType: 'User',
      entityId: req.user.id,
      ipAddress: clientIp(req),
      userAgent: req.headers['user-agent'],
    });
  }
  // Stateless JWT: the client discards the token.
  res.status(204).send();
});