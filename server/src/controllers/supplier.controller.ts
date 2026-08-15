import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

import prisma from '../lib/prisma.js';
import { ApiError } from '../middleware/error.js';
import { recordAudit, scalarize } from '../services/audit.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { paramId, parseBody, parseQuery } from '../utils/validate.js';
import {
  createSupplierSchema,
  supplierQuerySchema,
  updateSupplierSchema,
} from '../validators/supplier.validator.js';

const sharedScope = (branchId: string): Prisma.SupplierWhereInput => ({
  OR: [{ branchId: null }, { branchId }],
});

export const listSuppliers = asyncHandler(async (req: Request, res: Response) => {
  const query = parseQuery(supplierQuerySchema, req.query);

  const where: Prisma.SupplierWhereInput = {
    ...sharedScope(req.user!.branchId),
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' as const } },
            { contactPerson: { contains: query.search, mode: 'insensitive' as const } },
            { phone: { contains: query.search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.supplier.findMany({
      where,
      include: { _count: { select: { purchases: true } } },
      orderBy: { name: 'asc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.supplier.count({ where }),
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

export const getSupplier = asyncHandler(async (req: Request, res: Response) => {
  const supplier = await prisma.supplier.findFirst({
    where: { id: paramId(req, 'id'), ...sharedScope(req.user!.branchId) },
    include: {
      _count: { select: { purchases: true } },
      purchases: {
        orderBy: { purchaseDate: 'desc' },
        take: 10,
        select: { id: true, reference: true, purchaseDate: true, status: true, total: true },
      },
    },
  });
  if (!supplier) throw ApiError.notFound('Supplier not found');
  res.json({ data: supplier });
});

export const createSupplier = asyncHandler(async (req: Request, res: Response) => {
  const input = parseBody(createSupplierSchema, req.body);

  const supplier = await prisma.supplier.create({
    data: {
      name: input.name,
      contactPerson: input.contactPerson ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      address: input.address ?? null,
      taxNumber: input.taxNumber ?? null,
      status: input.status,
      branchId: null, // shared across branches by default
    },
  });

  await recordAudit({
    userId: req.user!.id,
    branchId: req.user!.branchId,
    action: 'CREATE',
    entityType: 'Supplier',
    entityId: supplier.id,
    newValue: scalarize(supplier),
  });

  res.status(201).json({ data: supplier });
});

export const updateSupplier = asyncHandler(async (req: Request, res: Response) => {
  const existing = await prisma.supplier.findFirst({
    where: { id: paramId(req, 'id'), ...sharedScope(req.user!.branchId) },
  });
  if (!existing) throw ApiError.notFound('Supplier not found');

  const input = parseBody(updateSupplierSchema, req.body);
  const data: Prisma.SupplierUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.contactPerson !== undefined) data.contactPerson = input.contactPerson;
  if (input.phone !== undefined) data.phone = input.phone;
  if (input.email !== undefined) data.email = input.email;
  if (input.address !== undefined) data.address = input.address;
  if (input.taxNumber !== undefined) data.taxNumber = input.taxNumber;
  if (input.status !== undefined) data.status = input.status;

  const supplier = await prisma.supplier.update({ where: { id: existing.id }, data });

  await recordAudit({
    userId: req.user!.id,
    branchId: req.user!.branchId,
    action: 'UPDATE',
    entityType: 'Supplier',
    entityId: supplier.id,
    previousValue: scalarize(existing),
    newValue: scalarize(supplier),
  });

  res.json({ data: supplier });
});

export const setSupplierStatus = asyncHandler(async (req: Request, res: Response) => {
  const existing = await prisma.supplier.findFirst({
    where: { id: paramId(req, 'id'), ...sharedScope(req.user!.branchId) },
  });
  if (!existing) throw ApiError.notFound('Supplier not found');

  const { status } = updateSupplierSchema
    .pick({ status: true })
    .parse(req.body);

  const supplier = await prisma.supplier.update({
    where: { id: existing.id },
    data: { status },
  });

  await recordAudit({
    userId: req.user!.id,
    branchId: req.user!.branchId,
    action: 'UPDATE',
    entityType: 'Supplier',
    entityId: supplier.id,
    previousValue: { status: existing.status },
    newValue: { status },
  });

  res.json({ data: supplier });
});