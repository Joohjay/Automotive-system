import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

import prisma from '../lib/prisma.js';
import { ApiError } from '../middleware/error.js';
import { recordAudit } from '../services/audit.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { paramId, parseBody, parseQuery } from '../utils/validate.js';
import {
  createExpenseSchema,
  createExpenseCategorySchema,
  updateExpenseCategorySchema,
  expenseQuerySchema,
} from '../validators/expense.validator.js';

export const listExpenses = asyncHandler(async (req: Request, res: Response) => {
  const query = parseQuery(expenseQuerySchema, req.query);

  const where: Prisma.ExpenseWhereInput = {
    branchId: req.user!.branchId,
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...(query.paymentMethod ? { paymentMethod: query.paymentMethod } : {}),
    ...(query.from || query.to
      ? { expenseDate: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } }
      : {}),
    ...(query.search
      ? { description: { contains: query.search, mode: 'insensitive' as const } }
      : {}),
  };

  const [data, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        createdBy: { select: { id: true, fullName: true } },
      },
      orderBy: { expenseDate: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.expense.count({ where }),
  ]);

  const pages = Math.ceil(total / query.pageSize);
  res.json({ data, pagination: { page: query.page, pageSize: query.pageSize, total, pages } });
});

export const getExpense = asyncHandler(async (req: Request, res: Response) => {
  const expense = await prisma.expense.findFirst({
    where: { id: paramId(req, 'id'), branchId: req.user!.branchId },
    include: {
      category: { select: { id: true, name: true } },
      createdBy: { select: { id: true, fullName: true } },
    },
  });
  if (!expense) throw ApiError.notFound('Expense not found');
  res.json({ data: expense });
});

export const createExpense = asyncHandler(async (req: Request, res: Response) => {
  const input = parseBody(createExpenseSchema, req.body);

  const category = await prisma.expenseCategory.findFirst({
    where: {
      id: input.categoryId,
      isActive: true,
      OR: [{ branchId: null }, { branchId: req.user!.branchId }],
    },
  });
  if (!category) throw ApiError.notFound('Expense category not found or inactive');

  const expense = await prisma.expense.create({
    data: {
      branchId: req.user!.branchId,
      categoryId: input.categoryId,
      description: input.description,
      amount: new Prisma.Decimal(input.amount),
      expenseDate: input.expenseDate,
      paymentMethod: input.paymentMethod,
      reference: input.reference ?? null,
      note: input.note ?? null,
      createdById: req.user!.id,
    },
  });

  await recordAudit({
    userId: req.user!.id,
    branchId: req.user!.branchId,
    action: 'CREATE',
    entityType: 'Expense',
    entityId: expense.id,
    newValue: {
      categoryId: expense.categoryId,
      description: expense.description,
      amount: expense.amount,
      paymentMethod: expense.paymentMethod,
    },
  });

  res.status(201).json({ data: expense });
});

export const listExpenseCategories = asyncHandler(async (req: Request, res: Response) => {
  const includeInactive = req.query.includeInactive === 'true';

  const where: Prisma.ExpenseCategoryWhereInput = {
    ...(includeInactive ? {} : { isActive: true }),
    OR: [{ branchId: null }, { branchId: req.user!.branchId }],
  };

  const data = await prisma.expenseCategory.findMany({
    where,
    orderBy: { name: 'asc' },
  });

  res.json({ data });
});

export const createExpenseCategory = asyncHandler(async (req: Request, res: Response) => {
  const input = parseBody(createExpenseCategorySchema, req.body);

  const category = await prisma.expenseCategory.create({
    data: {
      name: input.name,
      description: input.description ?? null,
      branchId: req.user!.branchId,
    },
  });

  await recordAudit({
    userId: req.user!.id,
    branchId: req.user!.branchId,
    action: 'CREATE',
    entityType: 'ExpenseCategory',
    entityId: category.id,
    newValue: { name: category.name, description: category.description },
  });

  res.status(201).json({ data: category });
});

export const updateExpenseCategory = asyncHandler(async (req: Request, res: Response) => {
  const input = parseBody(updateExpenseCategorySchema, req.body);

  const existing = await prisma.expenseCategory.findFirst({
    where: {
      id: paramId(req, 'id'),
      OR: [{ branchId: null }, { branchId: req.user!.branchId }],
    },
  });
  if (!existing) throw ApiError.notFound('Expense category not found');

  const category = await prisma.expenseCategory.update({
    where: { id: existing.id },
    data: input,
  });

  await recordAudit({
    userId: req.user!.id,
    branchId: req.user!.branchId,
    action: 'UPDATE',
    entityType: 'ExpenseCategory',
    entityId: category.id,
    previousValue: { name: existing.name, description: existing.description },
    newValue: { name: category.name, description: category.description },
  });

  res.json({ data: category });
});

export const expenseSummary = asyncHandler(async (req: Request, res: Response) => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const branchId = req.user!.branchId;

  const [monthResult, yearResult, categoryBreakdown] = await Promise.all([
    prisma.expense.aggregate({
      where: { branchId, expenseDate: { gte: monthStart } },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: { branchId, expenseDate: { gte: yearStart } },
      _sum: { amount: true },
    }),
    prisma.expense.groupBy({
      by: ['categoryId'],
      where: { branchId, expenseDate: { gte: monthStart } },
      _sum: { amount: true },
    }),
  ]);

  const categoryIds = categoryBreakdown.map((row) => row.categoryId);
  const categories = await prisma.expenseCategory.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true },
  });
  const categoryNameMap = new Map(categories.map((c) => [c.id, c.name]));

  const byCategory = categoryBreakdown.map((row) => ({
    categoryId: row.categoryId,
    name: categoryNameMap.get(row.categoryId) ?? 'Unknown',
    total: row._sum.amount ?? 0,
  }));

  const monthTotal = monthResult._sum.amount ?? 0;
  const yearTotal = yearResult._sum.amount ?? 0;

  res.json({ monthTotal, yearTotal, byCategory });
});
