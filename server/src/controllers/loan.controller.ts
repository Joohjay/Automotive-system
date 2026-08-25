import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

import prisma from '../lib/prisma.js';
import { ApiError } from '../middleware/error.js';
import { recordAudit, scalarize } from '../services/audit.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { paramId, parseBody, parseQuery } from '../utils/validate.js';
import {
  createLoanSchema,
  updateLoanSchema,
  loanPaymentSchema,
  generateScheduleSchema,
  loanQuerySchema,
} from '../validators/loan.validator.js';

export const listLoans = asyncHandler(async (req: Request, res: Response) => {
  const query = parseQuery(loanQuerySchema, req.query);

  const where: Prisma.LoanWhereInput = {
    branchId: req.user!.branchId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.from || query.to
      ? {
          startDate: {
            ...(query.from ? { gte: query.from } : {}),
            ...(query.to ? { lte: query.to } : {}),
          },
        }
      : {}),
    ...(query.search
      ? {
          OR: [
            { lender: { contains: query.search, mode: 'insensitive' as const } },
            { reference: { contains: query.search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.loan.findMany({
      where,
      include: {
        createdBy: { select: { id: true, fullName: true } },
        _count: { select: { payments: true, schedules: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.loan.count({ where }),
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

export const getLoan = asyncHandler(async (req: Request, res: Response) => {
  const loan = await prisma.loan.findFirst({
    where: { id: paramId(req, 'id'), branchId: req.user!.branchId },
    include: {
      createdBy: { select: { id: true, fullName: true } },
      schedules: { orderBy: { installmentNo: 'asc' } },
      payments: { orderBy: { paymentDate: 'desc' } },
    },
  });
  if (!loan) throw ApiError.notFound('Loan not found');
  res.json({ data: loan });
});

export const createLoan = asyncHandler(async (req: Request, res: Response) => {
  const input = parseBody(createLoanSchema, req.body);
  const branchId = req.user!.branchId;

  // Compute totalRepayment server-side to prevent loan forgiveness
  const principal = new Prisma.Decimal(input.principalAmount);
  const rate = new Prisma.Decimal(input.interestRate);
  const months = input.durationMonths;
  let expectedInterest: Prisma.Decimal;

  if (input.interestMethod === 'FLAT') {
    expectedInterest = principal.mul(rate).div(100).mul(months);
  } else if (input.interestMethod === 'REDUCING_BALANCE') {
    expectedInterest = principal.mul(rate).div(100).mul(months);
  } else {
    // FIXED_SCHEDULE: use user-provided value only as a hint, clamp to >= 0
    expectedInterest = new Prisma.Decimal(Math.max(0, input.totalExpectedInterest));
  }

  const totalRepayment = principal.plus(expectedInterest);

  const loan = await prisma.loan.create({
    data: {
      lender: input.lender,
      reference: input.reference ?? null,
      branchId,
      principalAmount: principal,
      interestRate: rate,
      interestMethod: input.interestMethod,
      durationMonths: months,
      startDate: input.startDate ?? new Date(),
      maturityDate: input.maturityDate ?? null,
      totalExpectedInterest: expectedInterest,
      totalRepayment,
      notes: input.notes ?? null,
      createdById: req.user!.id,
    },
  });

  await recordAudit({
    userId: req.user!.id,
    branchId,
    action: 'CREATE',
    entityType: 'Loan',
    entityId: loan.id,
    newValue: scalarize(loan),
  });

  res.status(201).json({ data: loan });
});

export const updateLoan = asyncHandler(async (req: Request, res: Response) => {
  const existing = await prisma.loan.findFirst({
    where: { id: paramId(req, 'id'), branchId: req.user!.branchId },
  });
  if (!existing) throw ApiError.notFound('Loan not found');
  if (existing.status !== 'ACTIVE') throw ApiError.badRequest('Only active loans can be updated');

  const input = parseBody(updateLoanSchema, req.body);
  const data: Prisma.LoanUpdateInput = {};
  if (input.lender !== undefined) data.lender = input.lender;
  if (input.reference !== undefined) data.reference = input.reference;
  if (input.interestRate !== undefined) data.interestRate = new Prisma.Decimal(input.interestRate);
  if (input.interestMethod !== undefined) data.interestMethod = input.interestMethod;
  if (input.durationMonths !== undefined) data.durationMonths = input.durationMonths;
  if (input.maturityDate !== undefined) data.maturityDate = input.maturityDate;
  if (input.totalExpectedInterest !== undefined)
    data.totalExpectedInterest = new Prisma.Decimal(input.totalExpectedInterest);
  if (input.totalRepayment !== undefined)
    data.totalRepayment = new Prisma.Decimal(input.totalRepayment);
  if (input.notes !== undefined) data.notes = input.notes;

  const loan = await prisma.loan.update({ where: { id: existing.id }, data });

  await recordAudit({
    userId: req.user!.id,
    branchId: req.user!.branchId,
    action: 'UPDATE',
    entityType: 'Loan',
    entityId: loan.id,
    previousValue: scalarize(existing),
    newValue: scalarize(loan),
  });

  res.json({ data: loan });
});

export const closeLoan = asyncHandler(async (req: Request, res: Response) => {
  const existing = await prisma.loan.findFirst({
    where: { id: paramId(req, 'id'), branchId: req.user!.branchId },
  });
  if (!existing) throw ApiError.notFound('Loan not found');
  if (existing.status !== 'ACTIVE') throw ApiError.badRequest('Only active loans can be closed');

  const targetRepayment = existing.totalRepayment.greaterThan(0)
    ? existing.totalRepayment
    : existing.principalAmount.plus(existing.totalExpectedInterest);

  const totalPaid = await prisma.loanPayment.aggregate({
    where: { loanId: existing.id },
    _sum: { amount: true },
  });
  const paid = totalPaid._sum.amount ?? new Prisma.Decimal(0);

  if (paid.lessThan(targetRepayment)) {
    throw ApiError.badRequest(
      `Outstanding balance remains. Required: ${targetRepayment.toFixed(2)}, paid: ${paid.toFixed(2)}`,
    );
  }

  const loan = await prisma.loan.update({
    where: { id: existing.id },
    data: { status: 'CLOSED' },
  });

  await recordAudit({
    userId: req.user!.id,
    branchId: req.user!.branchId,
    action: 'CLOSE',
    entityType: 'Loan',
    entityId: loan.id,
    previousValue: { status: existing.status },
    newValue: { status: 'CLOSED' },
  });

  res.json({ data: loan });
});

export const generateSchedule = asyncHandler(async (req: Request, res: Response) => {
  const loanId = paramId(req, 'id');

  const existing = await prisma.loan.findFirst({
    where: { id: loanId, branchId: req.user!.branchId },
  });
  if (!existing) throw ApiError.notFound('Loan not found');
  if (existing.status !== 'ACTIVE') throw ApiError.badRequest('Only active loans can have schedules');

  const existingSchedules = await prisma.loanSchedule.count({ where: { loanId } });
  if (existingSchedules > 0) {
    throw ApiError.badRequest('A schedule already exists for this loan. Remove it first.');
  }

  const input = parseBody(generateScheduleSchema, req.body);

  const schedules = await prisma.$transaction(async (tx) => {
    await tx.loanSchedule.deleteMany({ where: { loanId } });

    return tx.loanSchedule.createMany({
      data: input.installments.map((inst) => ({
        loanId,
        installmentNo: inst.installmentNo,
        dueDate: inst.dueDate,
        principalAmount: new Prisma.Decimal(inst.principalAmount),
        interestAmount: new Prisma.Decimal(inst.interestAmount),
        totalDue: new Prisma.Decimal(inst.totalDue),
      })),
    });
  });

  await recordAudit({
    userId: req.user!.id,
    branchId: req.user!.branchId,
    action: 'SCHEDULE',
    entityType: 'Loan',
    entityId: loanId,
    newValue: { installments: input.installments.length },
  });

  res.status(201).json({ data: { count: schedules.count } });
});

export const recordLoanPayment = asyncHandler(async (req: Request, res: Response) => {
  const loanId = paramId(req, 'id');

  const loan = await prisma.loan.findFirst({
    where: { id: loanId, branchId: req.user!.branchId },
  });
  if (!loan) throw ApiError.notFound('Loan not found');
  if (loan.status !== 'ACTIVE') throw ApiError.badRequest('Cannot record payments for non-active loans');

  const input = parseBody(loanPaymentSchema, req.body);

  // Reject overpayment: cumulative payments cannot exceed totalRepayment
  const targetRepayment = loan.totalRepayment.greaterThan(0)
    ? loan.totalRepayment
    : loan.principalAmount.plus(loan.totalExpectedInterest);
  const totalPaid = await prisma.loanPayment.aggregate({
    where: { loanId: loan.id },
    _sum: { amount: true },
  });
  const alreadyPaid = totalPaid._sum.amount ?? new Prisma.Decimal(0);
  const newTotal = alreadyPaid.plus(new Prisma.Decimal(input.amount));
  if (newTotal.greaterThan(targetRepayment)) {
    throw ApiError.badRequest(
      `Payment would exceed the total repayment of ${targetRepayment.toFixed(2)} (already paid ${alreadyPaid.toFixed(2)})`,
    );
  }

  let scheduleId: string | null = null;
  if (input.scheduleId) {
    const schedule = await prisma.loanSchedule.findFirst({
      where: { id: input.scheduleId, loanId },
    });
    if (!schedule) throw ApiError.notFound('Schedule installment not found for this loan');
    scheduleId = schedule.id;
  }

  const payment = await prisma.$transaction(async (tx) => {
    const created = await tx.loanPayment.create({
      data: {
        loanId,
        scheduleId,
        amount: new Prisma.Decimal(input.amount),
        paymentDate: input.paymentDate ?? new Date(),
        method: input.method,
        reference: input.reference ?? null,
        createdById: req.user!.id,
        note: input.note ?? null,
      },
    });

    if (scheduleId) {
      const schedule = await tx.loanSchedule.findUnique({ where: { id: scheduleId } });
      if (schedule) {
        const newAmountPaid = schedule.amountPaid.plus(new Prisma.Decimal(input.amount));
        await tx.loanSchedule.update({
          where: { id: scheduleId },
          data: {
            amountPaid: newAmountPaid,
            status: newAmountPaid.greaterThanOrEqualTo(schedule.totalDue) ? 'PAID' : 'PARTIALLY_PAID',
          },
        });
      }
    }

    return created;
  });

  await recordAudit({
    userId: req.user!.id,
    branchId: req.user!.branchId,
    action: 'PAYMENT',
    entityType: 'LoanPayment',
    entityId: payment.id,
    newValue: {
      loanId,
      amount: payment.amount,
      method: payment.method,
      scheduleId,
    },
  });

  res.status(201).json({ data: payment });
});

export const loanSummary = asyncHandler(async (req: Request, res: Response) => {
  const branchId = req.user!.branchId;

  const [loanAgg, paymentAgg, statusCounts] = await Promise.all([
    prisma.loan.aggregate({
      where: { branchId },
      _sum: { principalAmount: true, totalRepayment: true },
      _count: true,
    }),
    prisma.loanPayment.aggregate({
      where: { loan: { branchId } },
      _sum: { amount: true },
    }),
    prisma.loan.groupBy({
      by: ['status'],
      where: { branchId },
      _count: true,
    }),
  ]);

  const totalPrincipal = loanAgg._sum.principalAmount ?? new Prisma.Decimal(0);
  const totalRepayment = loanAgg._sum.totalRepayment ?? new Prisma.Decimal(0);
  const totalRepaid = paymentAgg._sum.amount ?? new Prisma.Decimal(0);
  const outstanding = totalRepayment.minus(totalRepaid);

  const countByStatus = Object.fromEntries(
    statusCounts.map((row) => [row.status, row._count]),
  );

  res.json({
    data: {
      totalPrincipal,
      totalRepayment,
      totalRepaid,
      outstanding,
      totalLoans: loanAgg._count,
      countByStatus,
    },
  });
});
