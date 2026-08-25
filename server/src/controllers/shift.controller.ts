import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

import prisma from '../lib/prisma.js';
import { ApiError } from '../middleware/error.js';
import { recordAudit } from '../services/audit.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { paramId, parseBody, parseQuery } from '../utils/validate.js';
import {
  openShiftSchema,
  closeShiftSchema,
  shiftQuerySchema,
} from '../validators/shift.validator.js';

export const listShifts = asyncHandler(async (req: Request, res: Response) => {
  const query = parseQuery(shiftQuerySchema, req.query);

  const where: Prisma.ShiftWhereInput = {
    branchId: req.user!.branchId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.from || query.to
      ? { openedAt: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.shift.findMany({
      where,
      include: {
        createdBy: { select: { id: true, fullName: true } },
      },
      orderBy: { openedAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.shift.count({ where }),
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

export const getShift = asyncHandler(async (req: Request, res: Response) => {
  const shift = await prisma.shift.findFirst({
    where: { id: paramId(req, 'id'), branchId: req.user!.branchId },
    include: {
      createdBy: { select: { id: true, fullName: true } },
    },
  });
  if (!shift) throw ApiError.notFound('Shift not found');
  res.json({ data: shift });
});

export const openShift = asyncHandler(async (req: Request, res: Response) => {
  const input = parseBody(openShiftSchema, req.body);
  const branchId = req.user!.branchId;

  const existing = await prisma.shift.findFirst({
    where: {
      branchId,
      createdById: req.user!.id,
      status: 'OPEN',
    },
  });
  if (existing) {
    throw ApiError.conflict('You already have an open shift in this branch');
  }

  const shift = await prisma.shift.create({
    data: {
      branchId,
      createdById: req.user!.id,
      openingCash: input.openingCash,
      notes: input.notes ?? null,
    },
    include: {
      createdBy: { select: { id: true, fullName: true } },
    },
  });

  await recordAudit({
    userId: req.user!.id,
    branchId,
    action: 'SHIFT_OPEN',
    entityType: 'Shift',
    entityId: shift.id,
    newValue: { openingCash: shift.openingCash },
  });

  res.status(201).json({ data: shift });
});

export const closeShift = asyncHandler(async (req: Request, res: Response) => {
  const input = parseBody(closeShiftSchema, req.body);
  const branchId = req.user!.branchId;

  const shift = await prisma.shift.findFirst({
    where: { id: paramId(req, 'id'), branchId },
  });
  if (!shift) throw ApiError.notFound('Shift not found');
  if (shift.status !== 'OPEN') throw ApiError.badRequest('Shift is already closed');

  const cashSales = await prisma.payment.aggregate({
    _sum: { amount: true },
    where: {
      sale: {
        branchId: shift.branchId,
        status: 'COMPLETED',
        saleDate: { gte: shift.openedAt, lte: new Date() },
      },
      method: 'CASH',
    },
  });
  const totalCashSales = Number(cashSales._sum.amount ?? 0);
  const expectedClosingCash = Number(shift.openingCash) + totalCashSales;
  const difference = input.actualClosingCash - expectedClosingCash;

  // Reconciliation guard: flag large discrepancies (more than 10% of expected or $50)
  const tolerance = Math.max(expectedClosingCash * 0.10, 50);
  if (Math.abs(difference) > tolerance) {
    throw ApiError.badRequest(
      `Cash discrepancy of ${difference.toFixed(2)} exceeds the tolerance of ${tolerance.toFixed(2)}. A manager must review.`,
    );
  }

  const updated = await prisma.shift.update({
    where: { id: shift.id },
    data: {
      expectedClosingCash,
      actualClosingCash: input.actualClosingCash,
      difference: input.actualClosingCash - expectedClosingCash,
      closedAt: new Date(),
      status: 'CLOSED',
      notes: input.notes ?? shift.notes,
    },
    include: {
      createdBy: { select: { id: true, fullName: true } },
    },
  });

  await recordAudit({
    userId: req.user!.id,
    branchId,
    action: 'SHIFT_CLOSE',
    entityType: 'Shift',
    entityId: shift.id,
    previousValue: { status: 'OPEN', openingCash: shift.openingCash },
    newValue: {
      expectedClosingCash,
      actualClosingCash: input.actualClosingCash,
      difference: input.actualClosingCash - expectedClosingCash,
    },
  });

  res.json({ data: updated });
});

export const shiftSummary = asyncHandler(async (req: Request, res: Response) => {
  const branchId = req.user!.branchId;

  const shift = await prisma.shift.findFirst({
    where: {
      branchId,
      createdById: req.user!.id,
      status: 'OPEN',
    },
    include: {
      createdBy: { select: { id: true, fullName: true } },
    },
  });

  if (!shift) {
    res.json({ openShift: null });
    return;
  }

  const salesWhere = {
    branchId,
    status: 'COMPLETED' as const,
    saleDate: { gte: shift.openedAt, lte: new Date() },
  };

  const [totalSalesResult, totalCashResult, totalMpesaResult, transactionCount] = await Promise.all([
    prisma.sale.aggregate({
      _sum: { total: true },
      where: salesWhere,
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        sale: salesWhere,
        method: 'CASH',
      },
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        sale: salesWhere,
        method: 'MPESA',
      },
    }),
    prisma.sale.count({
      where: salesWhere,
    }),
  ]);

  res.json({
    openShift: shift,
    totalSales: Number(totalSalesResult._sum.total ?? 0),
    totalCashReceived: Number(totalCashResult._sum.amount ?? 0),
    totalMpesaReceived: Number(totalMpesaResult._sum.amount ?? 0),
    transactionCount,
  });
});
