import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { z } from 'zod';

import prisma from '../lib/prisma.js';
import { ApiError } from '../middleware/error.js';
import { recordAudit } from '../services/audit.service.js';
import { applyStockChange } from '../services/inventory.service.js';
import { notifyStockStatus } from '../services/notification.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { parseBody, parseQuery } from '../utils/validate.js';

const adjustmentSchema = z.object({
  productId: z.string().min(1),
  locationId: z.string().min(1),
  newQuantity: z.coerce.number().int().min(0, 'Quantity cannot be negative'),
  reason: z.string().min(1, 'A reason is required'),
  note: z.string().max(500).optional().nullable(),
});

const txQuerySchema = z.object({
  productId: z.string().optional(),
  type: z.enum(['PURCHASE', 'SALE', 'RETURN', 'DAMAGE', 'ADJUSTMENT', 'TRANSFER']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const getSummary = asyncHandler(async (req: Request, res: Response) => {
  const branchId = req.user!.branchId;

  const [totalProducts, inventoryRows, recentReceived, recentMovements] =
    await Promise.all([
      prisma.product.count({ where: { status: 'ACTIVE' } }),
      prisma.inventory.findMany({
        where: { branchId },
        include: {
          product: {
            select: {
              minStockLevel: true,
              name: true,
              sku: true,
              partNumber: true,
              brand: { select: { name: true } },
            },
          },
          location: { select: { code: true, name: true } },
        },
      }),
      prisma.inventoryTransaction.findMany({
        where: { branchId, type: { in: ['PURCHASE', 'RETURN'] } },
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: { product: { select: { name: true, sku: true } }, location: { select: { name: true } } },
      }),
      prisma.inventoryTransaction.findMany({
        where: { branchId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { product: { select: { name: true, sku: true } }, location: { select: { name: true } } },
      }),
    ]);

  let totalUnits = 0;
  let lowStock = 0;
  let outOfStock = 0;
  const outOfStockItems: Array<{
    productId: string;
    name: string;
    sku: string;
    partNumber: string | null;
    brand: string | null;
    quantityOnHand: number;
    locationCode: string;
    locationName: string;
  }> = [];

  for (const inv of inventoryRows) {
    totalUnits += inv.quantityOnHand;
    if (inv.quantityOnHand <= 0) {
      outOfStock += 1;
      outOfStockItems.push({
        productId: inv.productId,
        name: inv.product.name,
        sku: inv.product.sku,
        partNumber: inv.product.partNumber ?? null,
        brand: inv.product.brand?.name ?? null,
        quantityOnHand: inv.quantityOnHand,
        locationCode: inv.location.code,
        locationName: inv.location.name,
      });
    } else if (inv.quantityOnHand <= inv.product.minStockLevel) lowStock += 1;
  }

  res.json({
    data: {
      totalProducts,
      totalUnits,
      lowStock,
      outOfStock,
      outOfStockItems,
      recentReceived,
      recentMovements,
    },
  });
});

export const listTransactions = asyncHandler(async (req: Request, res: Response) => {
  const query = parseQuery(txQuerySchema, req.query);
  const where: Prisma.InventoryTransactionWhereInput = {
    branchId: req.user!.branchId,
    ...(query.productId ? { productId: query.productId } : {}),
    ...(query.type ? { type: query.type } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.inventoryTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: {
        product: { select: { name: true, sku: true } },
        location: { select: { name: true, code: true } },
      },
    }),
    prisma.inventoryTransaction.count({ where }),
  ]);

  res.json({
    data,
    pagination: { page: query.page, pageSize: query.pageSize, total, pages: Math.ceil(total / query.pageSize) },
  });
});

export const createAdjustment = asyncHandler(async (req: Request, res: Response) => {
  const input = parseBody(adjustmentSchema, req.body);

  const product = await prisma.product.findUnique({ where: { id: input.productId } });
  if (!product) throw ApiError.notFound('Product not found');

  const location = await prisma.storageLocation.findFirst({
    where: { id: input.locationId, branchId: req.user!.branchId },
  });
  if (!location) throw ApiError.badRequest('Unknown storage location');

  const inventory = await prisma.inventory.findUnique({
    where: {
      branchId_productId_locationId: {
        branchId: req.user!.branchId,
        productId: input.productId,
        locationId: input.locationId,
      },
    },
  });
  const current = inventory?.quantityOnHand ?? 0;
  const delta = input.newQuantity - current;

  if (delta !== 0) {
    await prisma.$transaction(async (tx) => {
      await applyStockChange(tx, {
        branchId: req.user!.branchId,
        productId: input.productId,
        locationId: input.locationId,
        type: 'ADJUSTMENT',
        quantity: delta,
        referenceType: 'ADJUSTMENT',
        referenceId: `ADJ-${Date.now().toString(36)}`,
        createdById: req.user!.id,
        note: input.reason,
      });
    });
  }

  await recordAudit({
    userId: req.user!.id,
    branchId: req.user!.branchId,
    action: 'STOCK_ADJUSTMENT',
    entityType: 'Product',
    entityId: input.productId,
    previousValue: { quantityOnHand: current },
    newValue: { quantityOnHand: input.newQuantity, reason: input.reason },
  });

  await notifyStockStatus(
    req.user!.branchId,
    input.productId,
    input.newQuantity,
    product.minStockLevel,
  );

  res.json({
    data: { productId: input.productId, quantityOnHand: input.newQuantity, adjusted: delta },
  });
});

export const listStock = asyncHandler(async (req: Request, res: Response) => {
  const branchId = req.user!.branchId;
  const rows = await prisma.inventory.findMany({
    where: { branchId },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          partNumber: true,
          sellingPrice: true,
          minStockLevel: true,
          status: true,
          unitOfMeasure: true,
          brand: { select: { name: true } },
          category: { select: { name: true } },
        },
      },
      location: { select: { code: true, name: true } },
    },
    orderBy: { product: { name: 'asc' } },
  });

  res.json({ data: rows });
});