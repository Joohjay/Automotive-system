import type { Request, Response } from 'express';
import { z } from 'zod';

import prisma from '../lib/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { parseQuery } from '../utils/validate.js';

const periodQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

const dateRange = (from?: Date, to?: Date) => {
  const end = to ?? new Date();
  const start = from ?? new Date(end.getFullYear(), end.getMonth(), 1);
  return { gte: start, lte: end };
};

export const salesReport = asyncHandler(async (req: Request, res: Response) => {
  const { branchId } = req.user!;
  const { from, to } = parseQuery(periodQuerySchema, req.query);
  const range = dateRange(from, to);
  const where = { branchId, status: 'COMPLETED' as const, saleDate: range };

  const [totals, byPaymentMethod, topProductsRaw, dailySales] = await Promise.all([
    prisma.sale.aggregate({
      _count: true,
      _sum: { total: true, discount: true },
      where,
    }),
    prisma.payment.groupBy({
      by: ['method'],
      _count: true,
      _sum: { amount: true },
      where: { sale: where },
    }),
    prisma.saleItem.groupBy({
      by: ['productId'],
      _sum: { quantity: true, lineTotal: true },
      _count: true,
      where: { sale: where },
      orderBy: { _sum: { lineTotal: 'desc' } },
      take: 10,
    }),
    prisma.$queryRaw<{ date: Date; count: bigint; total: unknown }[]>`
      SELECT
        date_trunc('day', "saleDate")::text AS date,
        COUNT(*)::int AS count,
        COALESCE(SUM("total"), 0) AS total
      FROM "Sale"
      WHERE "branchId" = ${branchId}
        AND "status" = 'COMPLETED'
        AND "saleDate" >= ${range.gte}
        AND "saleDate" <= ${range.lte}
      GROUP BY date_trunc('day', "saleDate")
      ORDER BY date_trunc('day', "saleDate")
    `,
  ]);

  const productIds = topProductsRaw.map((p) => p.productId);
  const products = productIds.length
    ? await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true } })
    : [];
  const productMap = new Map(products.map((p) => [p.id, p.name]));

  const topProducts = topProductsRaw.map((p) => ({
    productId: p.productId,
    name: productMap.get(p.productId) ?? '',
    quantity: Number(p._sum.quantity ?? 0),
    revenue: String(p._sum.lineTotal ?? 0),
  }));

  const responseByPayment = byPaymentMethod.map((p) => ({
    method: p.method,
    count: p._count,
    total: String(p._sum.amount ?? 0),
  }));

  const responseDaily = dailySales.map((d) => ({
    date: d.date.toString().slice(0, 10),
    count: d.count,
    total: String(d.total),
  }));

  res.json({
    data: {
      period: { from: range.gte, to: range.lte },
      totalSales: totals._count,
      totalRevenue: String(totals._sum.total ?? 0),
      totalDiscounts: String(totals._sum.discount ?? 0),
      byPaymentMethod: responseByPayment,
      topProducts,
      dailySales: responseDaily,
    },
  });
});

export const inventoryReport = asyncHandler(async (req: Request, res: Response) => {
  const { branchId } = req.user!;

  const [totals, byCategoryRaw, lowStockCount, outOfStockCount] = await Promise.all([
    prisma.inventory.aggregate({
      _sum: { quantityOnHand: true },
      _count: true,
      where: { branchId },
    }),
    prisma.inventory.groupBy({
      by: ['productId'],
      _sum: { quantityOnHand: true },
      where: { branchId },
    }),
    prisma.inventory.count({
      where: { branchId, quantityOnHand: { gt: 0, lte: 10 } },
    }),
    prisma.inventory.count({
      where: { branchId, quantityOnHand: 0 },
    }),
  ]);

  const productIds = byCategoryRaw.map((i) => i.productId);
  const products = productIds.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, categoryId: true },
      })
    : [];
  const productMap = new Map(products.map((p) => [p.id, p]));

  const categoryAgg = new Map<string, { name: string; productCount: number; totalUnits: number }>();
  for (const row of byCategoryRaw) {
    const product = productMap.get(row.productId);
    const catId = product?.categoryId ?? 'unknown';
    const existing = categoryAgg.get(catId) ?? { name: '', productCount: 0, totalUnits: 0 };
    existing.productCount += 1;
    existing.totalUnits += Number(row._sum.quantityOnHand ?? 0);
    categoryAgg.set(catId, existing);
  }

  const catIds = [...categoryAgg.keys()].filter((id) => id !== 'unknown');
  const categories = catIds.length
    ? await prisma.category.findMany({ where: { id: { in: catIds } }, select: { id: true, name: true } })
    : [];
  const catNameMap = new Map(categories.map((c) => [c.id, c.name]));

  const byCategory = [...categoryAgg.entries()].map(([catId, agg]) => ({
    categoryId: catId,
    name: catId === 'unknown' ? 'Uncategorised' : (catNameMap.get(catId) ?? ''),
    productCount: agg.productCount,
    totalUnits: agg.totalUnits,
  }));

  res.json({
    data: {
      totalProducts: totals._count,
      totalUnits: Number(totals._sum.quantityOnHand ?? 0),
      lowStockCount,
      outOfStockCount,
      byCategory,
    },
  });
});

export const expenseReport = asyncHandler(async (req: Request, res: Response) => {
  const { branchId } = req.user!;
  const { from, to } = parseQuery(periodQuerySchema, req.query);
  const range = dateRange(from, to);

  const [totals, byCategoryRaw, byPaymentMethod] = await Promise.all([
    prisma.expense.aggregate({
      _count: true,
      _sum: { amount: true },
      where: { branchId, expenseDate: range },
    }),
    prisma.expense.groupBy({
      by: ['categoryId'],
      _sum: { amount: true },
      where: { branchId, expenseDate: range },
    }),
    prisma.expense.groupBy({
      by: ['paymentMethod'],
      _count: true,
      _sum: { amount: true },
      where: { branchId, expenseDate: range },
    }),
  ]);

  const categoryIds = byCategoryRaw.map((c) => c.categoryId).filter(Boolean) as string[];
  const categories = categoryIds.length
    ? await prisma.expenseCategory.findMany({ where: { id: { in: categoryIds } }, select: { id: true, name: true } })
    : [];
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  const responseByCategory = byCategoryRaw.map((c) => ({
    categoryId: c.categoryId,
    name: categoryMap.get(c.categoryId ?? '') ?? 'Unknown',
    total: String(c._sum.amount ?? 0),
  }));

  const responseByPayment = byPaymentMethod.map((p) => ({
    method: p.paymentMethod,
    count: p._count,
    total: String(p._sum.amount ?? 0),
  }));

  res.json({
    data: {
      period: { from: range.gte, to: range.lte },
      totalExpenses: String(totals._sum.amount ?? 0),
      byCategory: responseByCategory,
      byPaymentMethod: responseByPayment,
    },
  });
});

export const profitLoss = asyncHandler(async (req: Request, res: Response) => {
  const { branchId } = req.user!;
  const { from, to } = parseQuery(periodQuerySchema, req.query);
  const range = dateRange(from, to);

  const [revenue, cogsResult, expensesResult] = await Promise.all([
    prisma.sale.aggregate({
      _sum: { total: true },
      where: { branchId, status: 'COMPLETED', saleDate: range },
    }),
    prisma.inventoryTransaction.aggregate({
      _sum: { quantity: true },
      where: {
        branchId,
        type: 'SALE',
        createdAt: range,
      },
    }),
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: { branchId, expenseDate: range },
    }),
  ]);

  const saleTransactions = await prisma.inventoryTransaction.findMany({
    where: {
      branchId,
      type: 'SALE',
      createdAt: range,
    },
    select: { quantity: true, unitCost: true },
  });

  let cogs = 0;
  for (const tx of saleTransactions) {
    if (tx.unitCost) {
      cogs += Math.abs(tx.quantity) * Number(tx.unitCost);
    }
  }

  const rev = Number(revenue._sum.total ?? 0);
  const exp = Number(expensesResult._sum.amount ?? 0);

  res.json({
    data: {
      period: { from: range.gte, to: range.lte },
      revenue: String(rev),
      cogs: String(cogs),
      expenses: String(exp),
      grossProfit: String(rev - cogs),
      netProfit: String(rev - cogs - exp),
    },
  });
});
