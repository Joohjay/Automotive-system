import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

import prisma from '../lib/prisma.js';
import { ApiError } from '../middleware/error.js';
import { recordAudit } from '../services/audit.service.js';
import { nextDocumentNumber, todayRange } from '../services/document.service.js';
import { applyStockChange } from '../services/inventory.service.js';
import { notifyStockStatus } from '../services/notification.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { paramId, parseBody, parseQuery } from '../utils/validate.js';

function clientIp(req: Request): string | undefined {
  return req.ip ?? req.headers['x-forwarded-for']?.toString();
}
import {
  createSaleSchema,
  saleQuerySchema,
  voidSaleSchema,
} from '../validators/sale.validator.js';

async function defaultLocationId(branchId: string): Promise<string | null> {
  const loc = await prisma.storageLocation.findFirst({
    where: { branchId, isActive: true },
    orderBy: { code: 'asc' },
  });
  return loc?.id ?? null;
}

export const listSales = asyncHandler(async (req: Request, res: Response) => {
  const query = parseQuery(saleQuerySchema, req.query);

  const where: Prisma.SaleWhereInput = {
    branchId: req.user!.branchId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.customerId ? { customerId: query.customerId } : {}),
    ...(query.from || query.to
      ? { saleDate: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } }
      : {}),
    ...(query.search
      ? {
          OR: [
            { receiptNumber: { contains: query.search, mode: 'insensitive' as const } },
            { customer: { name: { contains: query.search, mode: 'insensitive' as const } } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.sale.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true } },
        createdBy: { select: { id: true, fullName: true } },
        _count: { select: { items: true, payments: true, returns: true } },
      },
      orderBy: { saleDate: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.sale.count({ where }),
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

export const getSale = asyncHandler(async (req: Request, res: Response) => {
  const sale = await prisma.sale.findFirst({
    where: { id: paramId(req, 'id'), branchId: req.user!.branchId },
    include: {
      customer: true,
      createdBy: { select: { id: true, fullName: true } },
      items: {
        orderBy: { createdAt: 'asc' },
        include: { product: { select: { id: true, name: true, sku: true, unitOfMeasure: true } } },
      },
      payments: { orderBy: { paidAt: 'asc' } },
      returns: {
        select: {
          id: true,
          returnNumber: true,
          totalRefund: true,
          status: true,
          returnDate: true,
        },
      },
    },
  });
  if (!sale) throw ApiError.notFound('Sale not found');
  res.json({ data: sale });
});

export const createSale = asyncHandler(async (req: Request, res: Response) => {
  const input = parseBody(createSaleSchema, req.body);
  const branchId = req.user!.branchId;

  const locationId = input.locationId ?? (await defaultLocationId(branchId));
  if (!locationId) throw ApiError.badRequest('No storage location is configured for this branch');

  const productIds = input.items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, status: 'ACTIVE' },
    select: { id: true, sellingPrice: true, purchasePrice: true, minStockLevel: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  for (const item of input.items) {
    if (!byId.has(item.productId)) throw ApiError.badRequest('One or more products are unavailable');
  }

  const inventoryRows = await prisma.inventory.findMany({
    where: { branchId, productId: { in: productIds } },
    select: { productId: true, avgCost: true },
  });
  const avgCostByProduct = new Map(inventoryRows.map((r) => [r.productId, r.avgCost]));

  const items = input.items.map((item) => {
    const product = byId.get(item.productId)!;
    const unitPrice = new Prisma.Decimal(product.sellingPrice);
    const quantity = item.quantity;
    const lineDiscount = new Prisma.Decimal(item.discount ?? 0);
    const lineSubtotal = unitPrice.mul(quantity);
    if (lineDiscount.greaterThan(lineSubtotal)) {
      throw ApiError.badRequest('Line discount cannot exceed the line total');
    }
    const lineTotal = lineSubtotal.minus(lineDiscount);
    return {
      productId: item.productId,
      quantity,
      unitPrice,
      discount: lineDiscount,
      lineTotal,
      cost: avgCostByProduct.get(item.productId) ?? product.purchasePrice,
      minStockLevel: product.minStockLevel,
    };
  });

  const subtotal = items.reduce((acc, i) => acc.plus(i.lineTotal), new Prisma.Decimal(0));
  const discount = new Prisma.Decimal(input.discount);
  if (discount.greaterThan(subtotal)) throw ApiError.badRequest('Discount cannot exceed the subtotal');
  const total = subtotal.minus(discount);
  if (total.lessThan(0)) throw ApiError.badRequest('Sale total cannot be negative');

  const payments = input.payments.map((p) => ({
    method: p.method,
    amount: new Prisma.Decimal(p.amount),
    reference: p.reference ?? null,
  }));
  const paidTotal = payments.reduce((acc, p) => acc.plus(p.amount), new Prisma.Decimal(0));
  if (paidTotal.lessThan(total)) {
    throw ApiError.badRequest('Payment does not cover the sale total');
  }

  const nonCashPaid = payments
    .filter((p) => p.method !== 'CASH')
    .reduce((acc, p) => acc.plus(p.amount), new Prisma.Decimal(0));
  const changeDue = paidTotal.minus(total);
  if (changeDue.greaterThan(0) && nonCashPaid.greaterThan(total)) {
    throw ApiError.badRequest('Overpayment is only allowed with cash; reduce the amount paid');
  }
  // Cap cash overpayment: changeDue cannot exceed 20% of total
  if (changeDue.greaterThan(total.mul(0.20))) {
    throw ApiError.badRequest('Cash overpayment exceeds the allowed maximum (20% of total)');
  }

  const creditAmount = payments
    .filter((p) => p.method === 'CREDIT')
    .reduce((acc, p) => acc.plus(p.amount), new Prisma.Decimal(0));

  let customerId: string | null = null;
  if (creditAmount.greaterThan(0)) {
    if (!input.customerId) {
      throw ApiError.badRequest('A customer is required for credit payment');
    }
    const customer = await prisma.customer.findFirst({
      where: {
        id: input.customerId,
        OR: [{ branchId }, { branchId: null }],
      },
    });
    if (!customer) throw ApiError.notFound('Customer not found');
    if (!customer.creditEligible) {
      throw ApiError.badRequest('This customer is not credit eligible');
    }
    customerId = customer.id;

    const account = await prisma.creditAccount.upsert({
      where: { customerId: customer.id },
      update: {},
      create: {
        customerId: customer.id,
        branchId,
        creditLimit: customer.creditLimit,
        status: 'OPEN',
      },
    });
    const projected = account.outstandingBalance.plus(creditAmount);
    if (account.creditLimit.greaterThan(0) && projected.greaterThan(account.creditLimit)) {
      throw ApiError.badRequest(
        `Credit would exceed the limit of ${account.creditLimit.toFixed(2)} (outstanding ${account.outstandingBalance.toFixed(2)})`,
      );
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const receiptNumber = await nextDocumentNumber(tx, branchId, 'RCP');
    const sale = await tx.sale.create({
      data: {
        branchId,
        receiptNumber,
        customerId,
        createdById: req.user!.id,
        subtotal,
        discount,
        total,
        changeDue,
        status: 'COMPLETED',
        notes: input.notes ?? null,
        saleDate: new Date(),
        items: {
          create: items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            discount: i.discount,
            lineTotal: i.lineTotal,
            cost: i.cost,
          })),
        },
        payments: { create: payments },
      },
    });

    for (const item of items) {
      await applyStockChange(tx, {
        branchId,
        productId: item.productId,
        locationId,
        type: 'SALE',
        quantity: -item.quantity,
        unitCost: item.cost,
        referenceType: 'SALE',
        referenceId: sale.id,
        createdById: req.user!.id,
        note: `Sale ${receiptNumber}`,
      });
    }

    if (creditAmount.greaterThan(0)) {
      await tx.creditAccount.update({
        where: { customerId: customerId! },
        data: { outstandingBalance: { increment: creditAmount } },
      });
    }

    return { sale, receiptNumber };
  });

  for (const item of items) {
    await notifyStockStatus(branchId, item.productId, 0, item.minStockLevel);
  }

  await recordAudit({
    userId: req.user!.id,
    branchId,
    action: 'SALE',
    entityType: 'Sale',
    entityId: result.sale.id,
    newValue: {
      receiptNumber: result.receiptNumber,
      total: result.sale.total,
      paymentMethods: payments.map((p) => p.method),
      creditAmount: creditAmount.toFixed(2),
    },
    ipAddress: clientIp(req),
    userAgent: req.headers['user-agent'],
  });

  res.status(201).json({ data: result.sale });
});

export const voidSale = asyncHandler(async (req: Request, res: Response) => {
  const input = parseBody(voidSaleSchema, req.body);
  const branchId = req.user!.branchId;
  const saleId = paramId(req, 'id');

  const sale = await prisma.sale.findFirst({
    where: { id: saleId, branchId },
    include: {
      items: { select: { id: true, productId: true, quantity: true } },
      payments: { select: { id: true, method: true, amount: true } },
    },
  });
  if (!sale) throw ApiError.notFound('Sale not found');
  if (sale.status !== 'COMPLETED') throw ApiError.badRequest('Only completed sales can be voided');

  const { start, end } = todayRange();
  if (sale.saleDate < start || sale.saleDate >= end) {
    throw ApiError.badRequest('Only sales from today can be voided');
  }

  // Only admins/managers can void sales created by other cashiers
  if (sale.createdById !== req.user!.id && !['ADMIN', 'MANAGER'].includes(req.user!.roleName)) {
    throw ApiError.forbidden('Only a manager or admin can void another user\'s sale');
  }

  const locationId = (await defaultLocationId(branchId)) ?? undefined;

  const result = await prisma.$transaction(async (tx) => {
    for (const item of sale.items) {
      const invTx = await tx.inventoryTransaction.findFirst({
        where: { branchId, productId: item.productId, type: 'SALE', referenceId: saleId },
        orderBy: { createdAt: 'desc' },
        select: { locationId: true },
      });
      await applyStockChange(tx, {
        branchId,
        productId: item.productId,
        locationId: invTx?.locationId ?? locationId!,
        type: 'RETURN',
        quantity: item.quantity,
        referenceType: 'SALE_VOID',
        referenceId: saleId,
        createdById: req.user!.id,
        note: `Void ${sale.receiptNumber}${input.reason ? `: ${input.reason}` : ''}`,
      });
    }

    const creditTotal = sale.payments
      .filter((p) => p.method === 'CREDIT')
      .reduce((acc, p) => acc.plus(p.amount), new Prisma.Decimal(0));
    if (creditTotal.greaterThan(0) && sale.customerId) {
      await tx.creditAccount.update({
        where: { customerId: sale.customerId },
        data: { outstandingBalance: { decrement: creditTotal } },
      });
    }

    await tx.payment.updateMany({ where: { saleId }, data: { status: 'REFUNDED' } });
    const voidNote = input.reason ? `Voided: ${input.reason}` : 'Voided';
    return tx.sale.update({
      where: { id: saleId },
      data: { status: 'VOID', notes: sale.notes ? `${sale.notes}\n${voidNote}` : voidNote },
    });
  });

  await recordAudit({
    userId: req.user!.id,
    branchId,
    action: 'VOID',
    entityType: 'Sale',
    entityId: sale.id,
    previousValue: { status: 'COMPLETED' },
    newValue: { status: 'VOID', reason: input.reason },
    ipAddress: clientIp(req),
    userAgent: req.headers['user-agent'],
  });

  res.json({ data: result });
});