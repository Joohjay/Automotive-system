import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

import prisma from '../lib/prisma.js';
import { ApiError } from '../middleware/error.js';
import { recordAudit, scalarize } from '../services/audit.service.js';
import { applyStockChange } from '../services/inventory.service.js';
import { notifyStockStatus } from '../services/notification.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { paramId, parseBody, parseQuery } from '../utils/validate.js';
import {
  createPurchaseSchema,
  purchaseQuerySchema,
  receivePurchaseSchema,
} from '../validators/purchase.validator.js';

function deriveStatus(items: { quantity: number; receivedQty: number }[]): 'RECEIVED' | 'PARTIALLY_RECEIVED' {
  const allReceived = items.every((i) => i.receivedQty >= i.quantity);
  return allReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED';
}

export const listPurchases = asyncHandler(async (req: Request, res: Response) => {
  const query = parseQuery(purchaseQuerySchema, req.query);

  const where: Prisma.PurchaseWhereInput = {
    branchId: req.user!.branchId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.supplierId ? { supplierId: query.supplierId } : {}),
    ...(query.from || query.to
      ? { purchaseDate: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } }
      : {}),
    ...(query.search
      ? {
          OR: [
            { reference: { contains: query.search, mode: 'insensitive' as const } },
            { supplier: { name: { contains: query.search, mode: 'insensitive' as const } } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.purchase.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
      orderBy: { purchaseDate: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.purchase.count({ where }),
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

export const getPurchase = asyncHandler(async (req: Request, res: Response) => {
  const purchase = await prisma.purchase.findFirst({
    where: { id: paramId(req, 'id'), branchId: req.user!.branchId },
    include: {
      supplier: true,
      createdBy: { select: { id: true, fullName: true } },
      items: {
        orderBy: { createdAt: 'asc' },
        include: {
          product: { select: { id: true, name: true, sku: true, unitOfMeasure: true } },
        },
      },
    },
  });
  if (!purchase) throw ApiError.notFound('Purchase order not found');
  res.json({ data: purchase });
});

export const createPurchase = asyncHandler(async (req: Request, res: Response) => {
  const input = parseBody(createPurchaseSchema, req.body);

  const supplier = await prisma.supplier.findFirst({
    where: { id: input.supplierId, OR: [{ branchId: null }, { branchId: req.user!.branchId }] },
  });
  if (!supplier) throw ApiError.notFound('Supplier not found');

  const productIds = input.items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true },
  });
  const found = new Set(products.map((p) => p.id));
  for (const item of input.items) {
    if (!found.has(item.productId)) throw ApiError.notFound('One or more products do not exist');
  }

  const items = input.items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    unitCost: new Prisma.Decimal(item.unitCost),
    totalCost: new Prisma.Decimal(item.unitCost).mul(item.quantity),
  }));

  const subtotal = items.reduce(
    (acc, i) => acc.plus(i.totalCost),
    new Prisma.Decimal(0),
  );
  const discount = new Prisma.Decimal(input.discount);
  if (discount.greaterThan(subtotal)) {
    throw ApiError.badRequest('Discount cannot exceed the subtotal');
  }
  const total = subtotal.minus(discount);

  const purchase = await prisma.$transaction(async (tx) => {
    return tx.purchase.create({
      data: {
        branchId: req.user!.branchId,
        supplierId: input.supplierId,
        reference: input.reference,
        purchaseDate: input.purchaseDate,
        status: 'PENDING',
        subtotal,
        discount,
        total,
        notes: input.notes ?? null,
        createdById: req.user!.id,
        items: { create: items },
      },
    });
  });

  await recordAudit({
    userId: req.user!.id,
    branchId: req.user!.branchId,
    action: 'CREATE',
    entityType: 'Purchase',
    entityId: purchase.id,
    newValue: { reference: purchase.reference, total: purchase.total, items: items.length },
  });

  res.status(201).json({ data: purchase });
});

export const receivePurchase = asyncHandler(async (req: Request, res: Response) => {
  const input = parseBody(receivePurchaseSchema, req.body);

  const location = await prisma.storageLocation.findFirst({
    where: { id: input.locationId, branchId: req.user!.branchId, isActive: true },
  });
  if (!location) throw ApiError.badRequest('Unknown or inactive storage location');

  const purchase = await prisma.purchase.findFirst({
    where: { id: paramId(req, 'id'), branchId: req.user!.branchId },
    include: {
      supplier: { select: { name: true } },
      items: { select: { id: true, productId: true, quantity: true, receivedQty: true, unitCost: true } },
    },
  });
  if (!purchase) throw ApiError.notFound('Purchase order not found');
  if (purchase.status === 'CANCELLED') throw ApiError.badRequest('Cannot receive a cancelled purchase');

  const byId = new Map(purchase.items.map((i) => [i.id, i]));
  const receipts = input.items.map((r) => {
    const item = byId.get(r.itemId);
    if (!item) throw ApiError.badRequest('Purchase item not found');
    const remaining = item.quantity - item.receivedQty;
    if (r.quantity > remaining) {
      throw ApiError.badRequest(
        `Receiving ${r.quantity} exceeds the outstanding ${remaining} for an item`,
      );
    }
    return { item, quantity: r.quantity };
  });

  const results = await prisma.$transaction(async (tx) => {
    const resResults: { productId: string; quantityOnHand: number }[] = [];
    for (const { item, quantity } of receipts) {
      // Atomic conditional claim: only succeeds while the outstanding quantity
      // is available, so concurrent receive requests can never double-receive.
      const claimed = await tx.purchaseItem.updateMany({
        where: {
          id: item.id,
          receivedQty: { lte: item.quantity - quantity },
        },
        data: { receivedQty: { increment: quantity } },
      });
      if (claimed.count !== 1) {
        throw ApiError.conflict(
          'This purchase item was received concurrently. Please refresh and try again.',
        );
      }

      const stock = await applyStockChange(tx, {
        branchId: req.user!.branchId,
        productId: item.productId,
        locationId: input.locationId,
        type: 'PURCHASE',
        quantity,
        unitCost: item.unitCost,
        referenceType: 'PURCHASE',
        referenceId: item.id,
        createdById: req.user!.id,
        note: `Received: ${purchase.reference} (${purchase.supplier.name})`,
      });
      resResults.push({ productId: item.productId, quantityOnHand: stock.quantityOnHand });
    }

    const refreshed = await tx.purchaseItem.findMany({
      where: { purchaseId: purchase.id },
      select: { quantity: true, receivedQty: true },
    });
    const status = deriveStatus(refreshed);
    await tx.purchase.update({ where: { id: purchase.id }, data: { status } });
    return { status, resResults };
  });

  await recordAudit({
    userId: req.user!.id,
    branchId: req.user!.branchId,
    action: 'RECEIVE',
    entityType: 'Purchase',
    entityId: purchase.id,
    newValue: {
      status: results.status,
      lines: receipts.map((r) => ({ itemId: r.item.id, quantity: r.quantity })),
    },
  });

  for (const r of results.resResults) {
    const product = await prisma.product.findUnique({
      where: { id: r.productId },
      select: { minStockLevel: true },
    });
    if (product) {
      await notifyStockStatus(req.user!.branchId, r.productId, r.quantityOnHand, product.minStockLevel);
    }
  }

  res.json({ data: { id: purchase.id, status: results.status, receivedLines: receipts.length } });
});

export const cancelPurchase = asyncHandler(async (req: Request, res: Response) => {
  const purchase = await prisma.purchase.findFirst({
    where: { id: paramId(req, 'id'), branchId: req.user!.branchId },
    include: { items: { select: { receivedQty: true } } },
  });
  if (!purchase) throw ApiError.notFound('Purchase order not found');

  if (purchase.status === 'CANCELLED') throw ApiError.badRequest('Purchase is already cancelled');
  if (purchase.status === 'RECEIVED' || purchase.status === 'PARTIALLY_RECEIVED') {
    throw ApiError.badRequest(
      'Cannot cancel after goods have been received. Record a damage/adjustment to remove stock.',
    );
  }

  const updated = await prisma.purchase.update({
    where: { id: purchase.id },
    data: { status: 'CANCELLED' },
  });

  await recordAudit({
    userId: req.user!.id,
    branchId: req.user!.branchId,
    action: 'CANCEL',
    entityType: 'Purchase',
    entityId: purchase.id,
    previousValue: { status: purchase.status },
    newValue: { status: 'CANCELLED' },
  });

  res.json({ data: { id: updated.id, status: updated.status } });
});