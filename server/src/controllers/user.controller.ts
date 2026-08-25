import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

import prisma from '../lib/prisma.js';
import { config } from '../config/env.js';
import { ApiError } from '../middleware/error.js';
import {
  assertCanManageAdminAccount,
  assertKeepsActiveAdmin,
} from '../services/admin-guard.service.js';
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

async function roleNameOf(roleId: string | undefined): Promise<string | null> {
  if (!roleId) return null;
  const role = await prisma.role.findUnique({ where: { id: roleId }, select: { name: true } });
  return role?.name ?? null;
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

  const newRoleName = await roleNameOf(input.roleId);
  assertCanManageAdminAccount(req.user!.roleName, newRoleName);

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);

  const user = await prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      fullName: input.fullName,
      phone: input.phone ?? null,
      roleId: input.roleId,
      branchId: input.branchId,
      passwordHash,
      mustChangePassword: true,
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
    include: { role: { select: { name: true } } },
  });
  if (!existing) throw ApiError.notFound('User not found');

  const input = parseBody(updateUserSchema, req.body);
  if (existing.id === req.user!.id && input.status === 'INACTIVE') {
    throw ApiError.conflict('You cannot deactivate your own account');
  }
  const prospectiveRoleName = await roleNameOf(input.roleId);
  assertCanManageAdminAccount(req.user!.roleName, existing.role?.name);
  assertCanManageAdminAccount(req.user!.roleName, prospectiveRoleName);
  await assertKeepsActiveAdmin({
    targetUserId: existing.id,
    becomesInactive: input.status === 'INACTIVE',
    ...(input.roleId !== undefined ? { newRoleId: input.roleId } : {}),
  });

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
    include: { role: { select: { name: true } } },
  });
  if (!existing) throw ApiError.notFound('User not found');
  assertCanManageAdminAccount(req.user!.roleName, existing.role?.name);

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
    include: { role: { select: { name: true } } },
  });
  if (!existing) throw ApiError.notFound('User not found');
  if (existing.id === req.user!.id) {
    throw ApiError.conflict('You cannot deactivate your own account');
  }
  assertCanManageAdminAccount(req.user!.roleName, existing.role?.name);
  await assertKeepsActiveAdmin({ targetUserId: existing.id, becomesInactive: true });

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
    include: { role: { select: { name: true } } },
  });
  if (!existing) throw ApiError.notFound('User not found');

  const { roleId } = parseBody(assignRoleSchema, req.body);

  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) throw ApiError.notFound('Role not found');
  assertCanManageAdminAccount(req.user!.roleName, existing.role?.name);
  assertCanManageAdminAccount(req.user!.roleName, role.name);

  await assertKeepsActiveAdmin({
    targetUserId: existing.id,
    newRoleId: roleId,
  });

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
    include: { role: { select: { name: true } } },
  });
  if (!existing) throw ApiError.notFound('User not found');
  assertCanManageAdminAccount(req.user!.roleName, existing.role?.name);

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
    include: { role: { select: { name: true } } },
  });
  if (!existing) throw ApiError.notFound('User not found');
  assertCanManageAdminAccount(req.user!.roleName, existing.role?.name);

  const input = parseBody(adminResetPasswordSchema, req.body);

  const BCRYPT_COST = 12;
  const newHash = await bcrypt.hash(input.password, BCRYPT_COST);

  await prisma.user.update({
    where: { id: existing.id },
    data: { passwordHash: newHash, mustChangePassword: true },
  });

  if (config.emailProvider === 'console') {
    console.log(`\n========== ADMIN PASSWORD RESET (DEV MODE) ==========`);
    console.log(`User: ${existing.email}`);
    console.log(`New password set by admin. User must change on next login.`);
    console.log(`======================================================\n`);
  } else {
    await sendEmail({
      to: existing.email,
      subject: 'Your Password Has Been Reset — BennyBlax Enterprises',
      html: `<p>Hello ${existing.fullName},</p><p>Your password has been reset by the administrator.</p><p>Your new temporary password is:</p><p style="font-size:16px;font-weight:bold;padding:8px 12px;background:#f4f4f5;border-radius:6px;display:inline-block;">${input.password}</p><p style="margin-top:16px;">You will be asked to change this password when you sign in.</p><p>If you did not expect this, please contact the system administrator.</p>`,
      text: `Hello ${existing.fullName},\n\nYour password has been reset by the administrator.\nYour new temporary password is: ${input.password}\n\nYou will be asked to change this password when you sign in.\n\nIf you did not expect this, please contact the system administrator.`,
    });
  }

  await recordAudit({
    userId: req.user!.id,
    branchId: req.user!.branchId,
    action: 'ADMIN_PASSWORD_RESET_COMPLETED',
    entityType: 'User',
    entityId: existing.id,
    ipAddress: clientIp(req),
    userAgent: req.headers['user-agent'],
  });

  res.json({ message: 'Password has been reset. The user will be asked to change it on next login.' });
});
