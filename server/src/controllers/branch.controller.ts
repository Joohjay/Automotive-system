import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { z } from 'zod';

import prisma from '../lib/prisma.js';
import { ApiError } from '../middleware/error.js';
import { recordAudit, scalarize } from '../services/audit.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { paramId, parseBody, parseQuery } from '../utils/validate.js';
import {
  createBranchSchema,
  updateBranchSchema,
} from '../validators/branch.validator.js';

const branchQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

function clientIp(req: Request): string | undefined {
  return req.ip ?? req.headers['x-forwarded-for']?.toString();
}

export const listBranches = asyncHandler(async (req: Request, res: Response) => {
  const query = parseQuery(branchQuerySchema, req.query);

  const where: Prisma.BranchWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' as const } },
            { code: { contains: query.search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.branch.findMany({
      where,
      include: { _count: { select: { users: true } } },
      orderBy: { name: 'asc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.branch.count({ where }),
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

export const getBranch = asyncHandler(async (req: Request, res: Response) => {
  const branch = await prisma.branch.findUnique({
    where: { id: paramId(req, 'id') },
    include: {
      _count: { select: { users: true } },
      users: {
        select: { id: true, email: true, fullName: true, status: true },
        orderBy: { fullName: 'asc' },
        take: 20,
      },
    },
  });
  if (!branch) throw ApiError.notFound('Branch not found');
  res.json({ data: branch });
});

export const createBranch = asyncHandler(async (req: Request, res: Response) => {
  const input = parseBody(createBranchSchema, req.body);

  const existing = await prisma.branch.findUnique({
    where: { code: input.code },
  });
  if (existing) throw ApiError.conflict('A branch with this code already exists');

  const branch = await prisma.branch.create({
    data: {
      name: input.name,
      code: input.code,
      address: input.address ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
    },
  });

  await recordAudit({
    userId: req.user!.id,
    branchId: req.user!.branchId,
    action: 'BRANCH_CREATED',
    entityType: 'Branch',
    entityId: branch.id,
    newValue: scalarize(branch),
    ipAddress: clientIp(req),
    userAgent: req.headers['user-agent'],
  });

  res.status(201).json({ data: branch });
});

export const updateBranch = asyncHandler(async (req: Request, res: Response) => {
  const existing = await prisma.branch.findUnique({
    where: { id: paramId(req, 'id') },
  });
  if (!existing) throw ApiError.notFound('Branch not found');

  const input = parseBody(updateBranchSchema, req.body);
  const data: Prisma.BranchUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.code !== undefined) data.code = input.code;
  if (input.address !== undefined) data.address = input.address;
  if (input.phone !== undefined) data.phone = input.phone;
  if (input.email !== undefined) data.email = input.email;
  if (input.status !== undefined) data.status = input.status;

  if (input.code && input.code !== existing.code) {
    const duplicate = await prisma.branch.findUnique({ where: { code: input.code } });
    if (duplicate) throw ApiError.conflict('A branch with this code already exists');
  }

  const branch = await prisma.branch.update({
    where: { id: existing.id },
    data,
  });

  await recordAudit({
    userId: req.user!.id,
    branchId: req.user!.branchId,
    action: 'BRANCH_UPDATED',
    entityType: 'Branch',
    entityId: branch.id,
    previousValue: scalarize(existing),
    newValue: scalarize(branch),
    ipAddress: clientIp(req),
    userAgent: req.headers['user-agent'],
  });

  res.json({ data: branch });
});

export const activateBranch = asyncHandler(async (req: Request, res: Response) => {
  const existing = await prisma.branch.findUnique({
    where: { id: paramId(req, 'id') },
  });
  if (!existing) throw ApiError.notFound('Branch not found');

  const branch = await prisma.branch.update({
    where: { id: existing.id },
    data: { status: 'ACTIVE' },
  });

  await recordAudit({
    userId: req.user!.id,
    branchId: req.user!.branchId,
    action: 'BRANCH_ACTIVATED',
    entityType: 'Branch',
    entityId: branch.id,
    previousValue: { status: existing.status },
    newValue: { status: branch.status },
    ipAddress: clientIp(req),
    userAgent: req.headers['user-agent'],
  });

  res.json({ data: branch });
});

export const deactivateBranch = asyncHandler(async (req: Request, res: Response) => {
  const existing = await prisma.branch.findUnique({
    where: { id: paramId(req, 'id') },
  });
  if (!existing) throw ApiError.notFound('Branch not found');

  const activeUserCount = await prisma.user.count({
    where: { branchId: existing.id, status: 'ACTIVE' },
  });
  if (activeUserCount > 0) {
    console.warn(
      `[branch] Deactivating branch "${existing.name}" (${existing.id}) with ${activeUserCount} active user(s)`,
    );
  }

  const branch = await prisma.branch.update({
    where: { id: existing.id },
    data: { status: 'INACTIVE' },
  });

  await recordAudit({
    userId: req.user!.id,
    branchId: req.user!.branchId,
    action: 'BRANCH_DEACTIVATED',
    entityType: 'Branch',
    entityId: branch.id,
    previousValue: { status: existing.status },
    newValue: { status: branch.status, activeUserCount },
    ipAddress: clientIp(req),
    userAgent: req.headers['user-agent'],
  });

  res.json({
    data: branch,
    warning: activeUserCount > 0 ? `Branch has ${activeUserCount} active user(s)` : undefined,
  });
});
