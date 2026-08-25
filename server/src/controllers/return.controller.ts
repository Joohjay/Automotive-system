import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

import prisma from '../lib/prisma.js';
import { ApiError } from '../middleware/error.js';
import { recordAudit } from '../services/audit.service.js';
import { nextDocumentNumber } from '../services/document.service.js';
import { applyStockChange } from '../services/inventory.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { paramId, parseBody, parseQuery } from '../utils/validate.js';
import { createReturnSchema, returnQuerySchema } from '../validators/return.validator.js';

async function defaultLocationId(branchId: string): Promise<string | null> {
  const loc = await prisma.storageLocation.findFirst({
    where: { branchId, isActive: true },
    orderBy: { code: 'asc' },
  });
  return loc?.id ?? null;
}

export const listReturns = asyncHandler(async (req: Request, res: Response) => {
  const query = parseQuery(returnQuerySchema, req.query);

  const where: Prisma.ReturnWhereInput = {
    branchId: req.user!.branchId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.from || query.to
      ? { returnDate: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } }
      : {}),
    ...(query.search
      ? {
          OR: [
            { returnNumber: { contains: query.search, mode: 'insensitive' as const } },
            { customer: { name: { contains: query.search, mode: 'insensitive' as const } } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.return.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true } },
        sale: { select: { id: true, receiptNumber: true } },
        createdBy: { select: { id: true, fullName: true } },
        items: { select: { id: true, quantity: true } },
      },
      orderBy: { returnDate: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.return.count({ where }),
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

export const getReturn = asyncHandler(async (req: Request, res: Response) => {
  const ret = await prisma.return.findFirst({
    where: { id: paramId(req, 'id'), branchId: req.user!.branchId },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      sale: { select: { id: true, receiptNumber: true } },
      createdBy: { select: { id: true, fullName: true } },
      items: {
        include: { product: { select: { id: true, name: true, sku: true } } },
      },
    },
  });
  if (!ret) throw ApiError.notFound('Return not found');
  res.json({ data: ret });
});

export const createReturn = asyncHandler(async (req: Request, res: Response) => {
  const input = parseBody(createReturnSchema, req.body);
  const branchId = req.user!.branchId;

  const locationId = input.locationId ?? (await defaultLocationId(branchId));
  if (!locationId) throw ApiError.badRequest('No storage location is configured for this branch');

  let customerId: string | null = null;
  const priceById = new Map<string, Prisma.Decimal>();
  const soldQtyById = new Map<string, number>();

  const sale = await prisma.sale.findFirst({
    where: { id: input.saleId, branchId, status: 'COMPLETED' },
    include: {
      items: { select: { productId: true, quantity: true, unitPrice: true } },
      returns: {
        select: {
          items: { select: { productId: true, quantity: true } },
          status: true,
        },
      },
    },
  });
  if (!sale) throw ApiError.notFound('Completed sale not found');
  customerId = sale.customerId ?? input.customerId ?? null;

  const returnedById = new Map<string, number>();
  for (const r of sale.returns) {
    if (r.status !== 'CANCELLED') {
      for (const ri of r.items) {
        returnedById.set(ri.productId, (returnedById.get(ri.productId) ?? 0) + ri.quantity);
      }
    }
  }
  for (const it of sale.items) {
    const remaining = it.quantity - (returnedById.get(it.productId) ?? 0);
    priceById.set(it.productId, new Prisma.Decimal(it.unitPrice));
    soldQtyById.set(it.productId, remaining);
  }

  if (input.customerId) customerId = input.customerId;

  const lines: Array<{
    productId: string;
    quantity: number;
    unitPrice: Prisma.Decimal;
    reason: string | null;
    condition: 'NEW' | 'DAMAGED';
    stockTreatment: 'RESTOCK' | 'DAMAGE' | 'DISCARD' | 'DONATE';
    lineRefund: Prisma.Decimal;
  }> = [];

  for (const item of input.items) {
    const unitPrice = priceById.get(item.productId);
    if (!unitPrice) throw ApiError.badRequest('A return item is not part of the sale or does not exist');
    if (soldQtyById.has(item.productId)) {
      const remaining = soldQtyById.get(item.productId)!;
      if (item.quantity > remaining) {
        throw ApiError.badRequest(
          `Cannot return ${item.quantity} of a product with only ${remaining} returnable`,
        );
      }
    }
    lines.push({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice,
      reason: item.reason ?? null,
      condition: item.condition,
      stockTreatment: item.stockTreatment,
      lineRefund: unitPrice.mul(item.quantity),
    });
  }

  const totalRefund = lines.reduce((acc, l) => acc.plus(l.lineRefund), new Prisma.Decimal(0));

  let creditAccount: { id: string; outstandingBalance: Prisma.Decimal } | null = null;
  if (input.refundMethod === 'CREDIT') {
    if (!customerId) throw ApiError.badRequest('A customer is required for a credit refund');
    creditAccount = await prisma.creditAccount.findFirst({
      where: { customerId, branchId },
    });
    if (!creditAccount) throw ApiError.badRequest('This customer has no credit account');
  }

  const result = await prisma.$transaction(async (tx) => {
    const returnNumber = await nextDocumentNumber(tx, branchId, 'RET');
    const ret = await tx.return.create({
      data: {
        branchId,
        returnNumber,
        saleId: input.saleId ?? null,
        customerId,
        createdById: req.user!.id,
        reason: input.reason ?? null,
        totalRefund,
        status: 'COMPLETED',
        returnDate: new Date(),
        items: {
          create: lines.map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            reason: l.reason,
            condition: l.condition,
            stockTreatment: l.stockTreatment,
          })),
        },
      },
    });

    for (const line of lines) {
      if (line.stockTreatment === 'RESTOCK') {
        await applyStockChange(tx, {
          branchId,
          productId: line.productId,
          locationId,
          type: 'RETURN',
          quantity: line.quantity,
          referenceType: 'RETURN',
          referenceId: ret.id,
          createdById: req.user!.id,
          note: `Return ${returnNumber}`,
        });
      }
    }

    if (creditAccount) {
      await tx.creditAccount.update({
        where: { id: creditAccount.id },
        data: { outstandingBalance: { decrement: totalRefund } },
      });
    }

    return { ret, returnNumber };
  });

  await recordAudit({
    userId: req.user!.id,
    branchId,
    action: 'RETURN',
    entityType: 'Return',
    entityId: result.ret.id,
    newValue: {
      returnNumber: result.returnNumber,
      totalRefund: totalRefund.toFixed(2),
      refundMethod: input.refundMethod,
      stockTreatment: lines.map((l) => l.stockTreatment),
    },
  });

  res.status(201).json({ data: result.ret });
});