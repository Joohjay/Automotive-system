import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

import prisma from '../lib/prisma.js';
import { config } from '../config/env.js';
import { ApiError } from '../middleware/error.js';
import { recordAudit, scalarize } from '../services/audit.service.js';
import { sendEmail } from '../services/email.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { paramId, parseBody, parseQuery } from '../utils/validate.js';
import {
  adminResetPasswordSchema,
  createUserSchema,
  updateUserSchema,
  userListQuerySchema,
} from '../validators/user.validator.js';

const BCRYPT_COST = 12;

function clientIp(req: Request): string | undefined {
  return req.ip ?? req.headers['x-forwarded-for']?.toString();
}

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const query = parseQuery(userListQuerySchema, req.query);

  const where: Prisma.UserWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.roleId ? { roleId: query.roleId } : {}),
    ...(query.branchId ? { branchId: query.branchId } : {}),
    ...(query.search
      ? {
          OR: [
            { fullName: { contains: query.search, mode: 'insensitive' as const } },
            { email: { contains: query.search, mode: 'insensitive' as const } },
            { phone: { contains: query.search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        roleId: true,
        branchId: true,
        role: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true, code: true } },
      },
      orderBy: { fullName: 'asc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  res.json({
    data,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      pages: Math.ceil(total / query.pageSize),
    },
  });
});

export const getUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: paramId(req, 'id') },
    select: {
      id: true,
      email: true,
      fullName: true,
      phone: true,
      status: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
      roleId: true,
      branchId: true,
      role: { select: { id: true, name: true } },
      branch: { select: { id: true, name: true, code: true } },
    },
  });
  if (!user) throw ApiError.notFound('User not found');
  res.json({ data: user });
});

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const input = parseBody(createUserSchema, req.body);

  const existing = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
  });
  if (existing) throw ApiError.conflict('A user with this email already exists');

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);

  const user = await prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      fullName: input.fullName,
      phone: input.phone ?? null,
      roleId: input.roleId,
      branchId: input.branchId,
      passwordHash,
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      phone: true,
      status: true,
      createdAt: true,
      roleId: true,
      branchId: true,
      role: { select: { id: true, name: true } },
      branch: { select: { id: true, name: true, code: true } },
    },
  });

  await recordAudit({
    userId: req.user!.id,
    branchId: req.user!.branchId,
    action: 'USER_CREATED',
    entityType: 'User',
    entityId: user.id,
    newValue: { email: user.email, fullName: user.fullName, roleId: user.roleId, branchId: user.branchId },
    ipAddress: clientIp(req),
    userAgent: req.headers['user-agent'],
  });

  res.status(201).json({ data: user });
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const existing = await prisma.user.findUnique({
    where: { id: paramId(req, 'id') },
  });
  if (!existing) throw ApiError.notFound('User not found');

  const input = parseBody(updateUserSchema, req.body);
  const data: Prisma.UserUpdateInput = {};
  if (input.email !== undefined) data.email = input.email.toLowerCase();
  if (input.fullName !== undefined) data.fullName = input.fullName;
  if (input.phone !== undefined) data.phone = input.phone;
  if (input.roleId !== undefined) data.role = { connect: { id: input.roleId } };
  if (input.branchId !== undefined) data.branch = { connect: { id: input.branchId } };
  if (input.status !== undefined) data.status = input.status;

  const user = await prisma.user.update({
    where: { id: existing.id },
    data,
    select: {
      id: true,
      email: true,
      fullName: true,
      phone: true,
      status: true,
      updatedAt: true,
      roleId: true,
      branchId: true,
      role: { select: { id: true, name: true } },
      branch: { select: { id: true, name: true, code: true } },
    },
  });

  await recordAudit({
    userId: req.user!.id,
    branchId: req.user!.branchId,
    action: 'USER_UPDATED',
    entityType: 'User',
    entityId: user.id,
    previousValue: { email: existing.email, fullName: existing.fullName, phone: existing.phone, roleId: existing.roleId, branchId: existing.branchId, status: existing.status },
    newValue: { email: user.email, fullName: user.fullName, phone: user.phone, roleId: user.roleId, branchId: user.branchId, status: user.status },
    ipAddress: clientIp(req),
    userAgent: req.headers['user-agent'],
  });

  res.json({ data: user });
});

export const activateUser = asyncHandler(async (req: Request, res: Response) => {
  const existing = await prisma.user.findUnique({
    where: { id: paramId(req, 'id') },
  });
  if (!existing) throw ApiError.notFound('User not found');

  const user = await prisma.user.update({
    where: { id: existing.id },
    data: { status: 'ACTIVE' },
    select: {
      id: true,
      email: true,
      fullName: true,
      status: true,
    },
  });

  await recordAudit({
    userId: req.user!.id,
    branchId: req.user!.branchId,
    action: 'USER_ACTIVATED',
    entityType: 'User',
    entityId: user.id,
    previousValue: { status: existing.status },
    newValue: { status: user.status },
    ipAddress: clientIp(req),
    userAgent: req.headers['user-agent'],
  });

  res.json({ data: user });
});

export const deactivateUser = asyncHandler(async (req: Request, res: Response) => {
  const existing = await prisma.user.findUnique({
    where: { id: paramId(req, 'id') },
  });
  if (!existing) throw ApiError.notFound('User not found');

  const user = await prisma.user.update({
    where: { id: existing.id },
    data: { status: 'INACTIVE' },
    select: {
      id: true,
      email: true,
      fullName: true,
      status: true,
    },
  });

  await recordAudit({
    userId: req.user!.id,
    branchId: req.user!.branchId,
    action: 'USER_DEACTIVATED',
    entityType: 'User',
    entityId: user.id,
    previousValue: { status: existing.status },
    newValue: { status: user.status },
    ipAddress: clientIp(req),
    userAgent: req.headers['user-agent'],
  });

  res.json({ data: user });
});

const assignRoleSchema = z.object({
  roleId: z.string().min(1, 'Role is required'),
});

export const assignRole = asyncHandler(async (req: Request, res: Response) => {
  const existing = await prisma.user.findUnique({
    where: { id: paramId(req, 'id') },
  });
  if (!existing) throw ApiError.notFound('User not found');

  const { roleId } = parseBody(assignRoleSchema, req.body);

  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) throw ApiError.notFound('Role not found');

  const user = await prisma.user.update({
    where: { id: existing.id },
    data: { roleId },
    select: {
      id: true,
      email: true,
      fullName: true,
      roleId: true,
      role: { select: { id: true, name: true } },
    },
  });

  await recordAudit({
    userId: req.user!.id,
    branchId: req.user!.branchId,
    action: 'ROLE_ASSIGNED',
    entityType: 'User',
    entityId: user.id,
    previousValue: { roleId: existing.roleId },
    newValue: { roleId: user.roleId, roleName: user.role.name },
    ipAddress: clientIp(req),
    userAgent: req.headers['user-agent'],
  });

  res.json({ data: user });
});

const assignBranchSchema = z.object({
  branchId: z.string().min(1, 'Branch is required'),
});

export const assignBranch = asyncHandler(async (req: Request, res: Response) => {
  const existing = await prisma.user.findUnique({
    where: { id: paramId(req, 'id') },
  });
  if (!existing) throw ApiError.notFound('User not found');

  const { branchId } = parseBody(assignBranchSchema, req.body);

  const branch = await prisma.branch.findUnique({ where: { id: branchId } });
  if (!branch) throw ApiError.notFound('Branch not found');

  const user = await prisma.user.update({
    where: { id: existing.id },
    data: { branchId },
    select: {
      id: true,
      email: true,
      fullName: true,
      branchId: true,
      branch: { select: { id: true, name: true, code: true } },
    },
  });

  await recordAudit({
    userId: req.user!.id,
    branchId: req.user!.branchId,
    action: 'BRANCH_ASSIGNED',
    entityType: 'User',
    entityId: user.id,
    previousValue: { branchId: existing.branchId },
    newValue: { branchId: user.branchId, branchName: user.branch.name },
    ipAddress: clientIp(req),
    userAgent: req.headers['user-agent'],
  });

  res.json({ data: user });
});

export const adminResetPassword = asyncHandler(async (req: Request, res: Response) => {
  const existing = await prisma.user.findUnique({
    where: { id: paramId(req, 'id') },
  });
  if (!existing) throw ApiError.notFound('User not found');

  parseBody(adminResetPasswordSchema, req.body);

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.passwordResetToken.create({
    data: {
      userId: existing.id,
      tokenHash,
      expiresAt,
    },
  });

  const resetUrl = `${config.clientOrigin}/reset-password?token=${rawToken}`;

  if (config.emailProvider === 'console') {
    console.log(`\n========== PASSWORD RESET (DEV MODE) ==========`);
    console.log(`User: ${existing.email}`);
    console.log(`Reset URL: ${resetUrl}`);
    console.log(`================================================\n`);
  } else {
    await sendEmail({
      to: existing.email,
      subject: 'Password Reset Request — BennyBlax Enterprises',
      html: `<p>Hello ${existing.fullName},</p><p>Click the link below to reset your password:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>This link expires in 1 hour.</p>`,
      text: `Hello ${existing.fullName},\n\nUse this link to reset your password: ${resetUrl}\n\nThis link expires in 1 hour.`,
    });
  }

  await recordAudit({
    userId: req.user!.id,
    branchId: req.user!.branchId,
    action: 'ADMIN_PASSWORD_RESET_INITIATED',
    entityType: 'User',
    entityId: existing.id,
    ipAddress: clientIp(req),
    userAgent: req.headers['user-agent'],
  });

  res.json({ message: 'Password reset link has been sent' });
});
