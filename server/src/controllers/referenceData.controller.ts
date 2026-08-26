import type { Request, Response } from 'express';
import { z } from 'zod';

import prisma from '../lib/prisma.js';
import { ApiError } from '../middleware/error.js';
import { recordAudit, scalarize } from '../services/audit.service.js';
import { getSettings } from '../services/settings.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { paramId, parseBody } from '../utils/validate.js';

const categorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  parentId: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
});

const brandSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  isActive: z.boolean().default(true),
});

const locationSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  type: z.string().max(20).default('AREA'),
  description: z.string().max(500).optional().nullable(),
  isActive: z.boolean().default(true),
});

function clientIp(req: Request): string | undefined {
  return req.ip ?? req.headers['x-forwarded-for']?.toString();
}

export const listCategories = asyncHandler(async (_req: Request, res: Response) => {
  const data = await prisma.category.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { products: true } } },
  });
  res.json({ data });
});

export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  const input = parseBody(categorySchema, req.body);
  const data = await prisma.category.create({
    data: {
      name: input.name,
      description: input.description,
      parentId: input.parentId,
      isActive: input.isActive,
    },
  });

  await recordAudit({
    userId: req.user!.id,
    branchId: req.user!.branchId,
    action: 'CREATE',
    entityType: 'Category',
    entityId: data.id,
    newValue: { name: data.name, description: data.description },
    ipAddress: clientIp(req),
    userAgent: req.headers['user-agent'],
  });

  res.status(201).json({ data });
});

export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  const input = parseBody(categorySchema.partial(), req.body);
  const existing = await prisma.category.findUnique({ where: { id: paramId(req, 'id') } });
  if (!existing) throw ApiError.notFound('Category not found');
  const data = await prisma.category.update({
    where: { id: paramId(req, 'id') },
    data: { ...input, parentId: input.parentId === undefined ? undefined : input.parentId },
  });

  await recordAudit({
    userId: req.user!.id,
    branchId: req.user!.branchId,
    action: 'UPDATE',
    entityType: 'Category',
    entityId: data.id,
    previousValue: scalarize(existing),
    newValue: scalarize(data),
    ipAddress: clientIp(req),
    userAgent: req.headers['user-agent'],
  });

  res.json({ data });
});

export const listBrands = asyncHandler(async (_req: Request, res: Response) => {
  const data = await prisma.brand.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { products: true } } },
  });
  res.json({ data });
});

export const createBrand = asyncHandler(async (req: Request, res: Response) => {
  const input = parseBody(brandSchema, req.body);
  const existing = await prisma.brand.findUnique({ where: { name: input.name } });
  if (existing) throw ApiError.conflict('A brand with this name already exists');
  const data = await prisma.brand.create({ data: input });

  await recordAudit({
    userId: req.user!.id,
    branchId: req.user!.branchId,
    action: 'CREATE',
    entityType: 'Brand',
    entityId: data.id,
    newValue: { name: data.name, description: data.description },
    ipAddress: clientIp(req),
    userAgent: req.headers['user-agent'],
  });

  res.status(201).json({ data });
});

export const updateBrand = asyncHandler(async (req: Request, res: Response) => {
  const input = parseBody(brandSchema.partial(), req.body);
  const existing = await prisma.brand.findUnique({ where: { id: paramId(req, 'id') } });
  if (!existing) throw ApiError.notFound('Brand not found');
  const data = await prisma.brand.update({
    where: { id: paramId(req, 'id') },
    data: input,
  });

  await recordAudit({
    userId: req.user!.id,
    branchId: req.user!.branchId,
    action: 'UPDATE',
    entityType: 'Brand',
    entityId: data.id,
    previousValue: scalarize(existing),
    newValue: scalarize(data),
    ipAddress: clientIp(req),
    userAgent: req.headers['user-agent'],
  });

  res.json({ data });
});

export const listLocations = asyncHandler(async (req: Request, res: Response) => {
  const data = await prisma.storageLocation.findMany({
    where: { branchId: req.user!.branchId },
    orderBy: { code: 'asc' },
  });
  res.json({ data });
});

export const createLocation = asyncHandler(async (req: Request, res: Response) => {
  const input = parseBody(locationSchema, req.body);
  const existing = await prisma.storageLocation.findUnique({
    where: { branchId_code: { branchId: req.user!.branchId, code: input.code.toUpperCase() } },
  });
  if (existing) throw ApiError.conflict('A location with this code already exists');
  const data = await prisma.storageLocation.create({
    data: {
      branchId: req.user!.branchId,
      code: input.code.toUpperCase(),
      name: input.name,
      type: input.type,
      description: input.description,
      isActive: input.isActive,
    },
  });

  await recordAudit({
    userId: req.user!.id,
    branchId: req.user!.branchId,
    action: 'CREATE',
    entityType: 'StorageLocation',
    entityId: data.id,
    newValue: { code: data.code, name: data.name, type: data.type },
    ipAddress: clientIp(req),
    userAgent: req.headers['user-agent'],
  });

  res.status(201).json({ data });
});

export const updateLocation = asyncHandler(async (req: Request, res: Response) => {
  const input = parseBody(locationSchema.partial(), req.body);
  const existing = await prisma.storageLocation.findFirst({
    where: { id: paramId(req, 'id'), branchId: req.user!.branchId },
  });
  if (!existing) throw ApiError.notFound('Location not found');
  const data = await prisma.storageLocation.update({
    where: { id: paramId(req, 'id') },
    data: input,
  });

  await recordAudit({
    userId: req.user!.id,
    branchId: req.user!.branchId,
    action: 'UPDATE',
    entityType: 'StorageLocation',
    entityId: data.id,
    previousValue: scalarize(existing),
    newValue: scalarize(data),
    ipAddress: clientIp(req),
    userAgent: req.headers['user-agent'],
  });

  res.json({ data });
});

export const getBusinessSettings = asyncHandler(async (req: Request, res: Response) => {
  const settings = await getSettings(req.user!.branchId);
  res.json({
    data: {
      businessName: settings.businessName ?? 'Blax Enterprises',
      currency: settings.currency ?? 'TZS',
      receiptFooter: settings.receiptFooter ?? '',
      address: settings.address ?? null,
      phone: settings.phone ?? null,
      email: settings.email ?? null,
    },
  });
});

export const listRoles = asyncHandler(async (_req: Request, res: Response) => {
  const data = await prisma.role.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });
  res.json({ data });
});

export const listBranchesRef = asyncHandler(async (_req: Request, res: Response) => {
  const data = await prisma.branch.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, code: true },
  });
  res.json({ data });
});