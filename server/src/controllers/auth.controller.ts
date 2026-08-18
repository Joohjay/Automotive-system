import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

import prisma from '../lib/prisma.js';
import { config } from '../config/env.js';
import { signAccessToken, toAuthUser } from '../lib/token.js';
import { ApiError } from '../middleware/error.js';
import { recordAudit } from '../services/audit.service.js';
import { sendEmail } from '../services/email.service.js';
import { getSettings } from '../services/settings.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { parseBody } from '../utils/validate.js';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
} from '../validators/auth.validator.js';

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
      failedLoginAttempts: true,
      lockedUntil: true,
      mustChangePassword: true,
      role: {
        select: { name: true, permissions: { select: { permission: { select: { code: true } } } } },
      },
      branch: { select: { status: true, name: true } },
    },
  });

  const LOCKOUT_THRESHOLD = 5;
  const LOCKOUT_MINUTES = 15;

  if (!user) {
    await recordAudit({
      action: 'FAILED_LOGIN',
      entityType: 'User',
      entityId: input.email.toLowerCase(),
      ipAddress: clientIp(req),
      userAgent: req.headers['user-agent'],
    });
    throw ApiError.unauthorized('Invalid email or password');
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const remaining = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    await recordAudit({
      userId: user.id,
      branchId: user.branchId,
      action: 'FAILED_LOGIN',
      entityType: 'User',
      entityId: user.id,
      ipAddress: clientIp(req),
      userAgent: req.headers['user-agent'],
    });
    throw ApiError.forbidden(`Account is locked. Try again in ${remaining} minute${remaining === 1 ? '' : 's'}.`);
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    const attempts = (user.failedLoginAttempts ?? 0) + 1;
    const lockUntil = attempts >= LOCKOUT_THRESHOLD
      ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
      : null;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: attempts,
        ...(lockUntil ? { lockedUntil: lockUntil } : {}),
      },
    });
    await recordAudit({
      userId: user.id,
      branchId: user.branchId,
      action: 'FAILED_LOGIN',
      entityType: 'User',
      entityId: user.id,
      ipAddress: clientIp(req),
      userAgent: req.headers['user-agent'],
    });
    if (lockUntil) {
      throw ApiError.forbidden(`Too many failed attempts. Account locked for ${LOCKOUT_MINUTES} minutes.`);
    }
    throw ApiError.unauthorized('Invalid email or password');
  }

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
    data: { lastLoginAt: new Date(), failedLoginAttempts: 0, lockedUntil: null },
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

  const permissions = user.role.permissions.map((rp) => rp.permission.code);

  res.json({
    token,
    mustChangePassword: user.mustChangePassword,
    user: toAuthUser({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      roleId: user.roleId,
      role: user.role,
      branchId: user.branchId,
      permissions,
    }),
    permissions,
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
      mustChangePassword: true,
      branchId: true,
      roleId: true,
      branch: { select: { name: true, code: true } },
      role: { select: { name: true, permissions: { select: { permission: { select: { code: true } } } } } },
    },
  });
  if (!user) throw ApiError.notFound('User not found');

  const settings = await getSettings(user.branchId);
  const permissions = user.role.permissions.map((rp) => rp.permission.code);

  res.json({
    user: toAuthUser({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      roleId: user.roleId,
      role: user.role,
      branchId: user.branchId,
      permissions,
    }),
    mustChangePassword: user.mustChangePassword,
    permissions,
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

const BCRYPT_COST = 12;

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const input = parseBody(changePasswordSchema, req.body);

  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { id: true, passwordHash: true },
  });
  if (!user) throw ApiError.notFound('User not found');

  const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);
  if (!valid) throw ApiError.badRequest('Current password is incorrect');

  const newHash = await bcrypt.hash(input.newPassword, BCRYPT_COST);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: newHash },
  });

  await recordAudit({
    userId: req.user!.id,
    branchId: req.user!.branchId,
    action: 'PASSWORD_CHANGED',
    entityType: 'User',
    entityId: user.id,
    ipAddress: clientIp(req),
    userAgent: req.headers['user-agent'],
  });

  res.json({ message: 'Password changed successfully' });
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const input = parseBody(forgotPasswordSchema, req.body);

  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
    select: { id: true, email: true, fullName: true, status: true },
  });

  // Always return the same message to prevent email enumeration
  const genericMessage = 'If an account exists with that email, a reset link has been sent.';

  if (!user) {
    res.json({ message: genericMessage });
    return;
  }

  if (user.status !== 'ACTIVE') {
    res.json({ message: genericMessage });
    return;
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  const resetUrl = `${config.clientOrigin}/reset-password?token=${rawToken}`;

  if (config.emailProvider === 'console') {
    console.log(`\n========== PASSWORD RESET (DEV MODE) ==========`);
    console.log(`User: ${user.email}`);
    console.log(`Reset URL: ${resetUrl}`);
    console.log(`================================================\n`);
  } else {
    await sendEmail({
      to: user.email,
      subject: 'Password Reset Request — BennyBlax Enterprises',
      html: `<p>Hello ${user.fullName},</p><p>Click the link below to reset your password:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>This link expires in 1 hour. If you did not request this, ignore this email.</p>`,
      text: `Hello ${user.fullName},\n\nUse this link to reset your password: ${resetUrl}\n\nThis link expires in 1 hour. If you did not request this, ignore this email.`,
    });
  }

  await recordAudit({
    userId: user.id,
    action: 'PASSWORD_RESET_REQUESTED',
    entityType: 'User',
    entityId: user.id,
    ipAddress: clientIp(req),
    userAgent: req.headers['user-agent'],
  });

  res.json({ message: genericMessage });
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const input = parseBody(resetPasswordSchema, req.body);

  const tokenHash = crypto.createHash('sha256').update(input.token).digest('hex');

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });

  if (!resetToken) {
    throw ApiError.badRequest('Invalid or expired reset token');
  }
  if (resetToken.usedAt) {
    throw ApiError.badRequest('This reset token has already been used');
  }
  if (resetToken.expiresAt < new Date()) {
    throw ApiError.badRequest('This reset token has expired');
  }

  const newHash = await bcrypt.hash(input.newPassword, BCRYPT_COST);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash: newHash },
    });
    await tx.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    });
  });

  await recordAudit({
    userId: resetToken.userId,
    action: 'PASSWORD_RESET_COMPLETED',
    entityType: 'User',
    entityId: resetToken.userId,
    ipAddress: clientIp(req),
    userAgent: req.headers['user-agent'],
  });

  res.json({ message: 'Password has been reset successfully' });
});