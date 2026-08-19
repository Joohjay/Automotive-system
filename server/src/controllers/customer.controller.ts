import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

import prisma from '../lib/prisma.js';
import { ApiError } from '../middleware/error.js';
import { recordAudit, scalarize } from '../services/audit.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { paramId, parseBody, parseQuery } from '../utils/validate.js';
import {
  createCustomerSchema,
  creditPaymentSchema,
  customerQuerySchema,
  updateCustomerSchema,
} from '../validators/customer.validator.js';

export const listCustomers = asyncHandler(async (req: Request, res: Response) => {
  const query = parseQuery(customerQuerySchema, req.query);
  const branchId = req.user!.branchId;

  const where: Prisma.CustomerWhereInput = {
    // Branch isolation: users only see customers belonging to their branch,
    // plus shared (branchId null) customers.
    AND: [
      { OR: [{ branchId }, { branchId: null }] },
      ...(query.search
        ? [
            {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' as const } },
                { phone: { contains: query.search, mode: 'insensitive' as const } },
              ],
            },
          ]
        : []),
    ],
    ...(query.status ? { status: query.status } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      include: {
        creditAccount: {
          select: { id: true, outstandingBalance: true, creditLimit: true, status: true },
        },
      },
      orderBy: { name: 'asc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.customer.count({ where }),
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

export const getCustomer = asyncHandler(async (req: Request, res: Response) => {
  const customer = await prisma.customer.findFirst({
    where: {
      id: paramId(req, 'id'),
      OR: [{ branchId: req.user!.branchId }, { branchId: null }],
    },
    include: {
      creditAccount: {
        include: {
          creditPayments: {
            orderBy: { paidAt: 'desc' },
            take: 20,
            select: { id: true, amount: true, method: true, reference: true, paidAt: true, note: true },
          },
        },
      },
      sales: {
        where: { branchId: req.user!.branchId },
        orderBy: { saleDate: 'desc' },
        take: 10,
        select: { id: true, receiptNumber: true, total: true, status: true, saleDate: true },
      },
    },
  });
  if (!customer) throw ApiError.notFound('Customer not found');
  res.json({ data: customer });
});

export const createCustomer = asyncHandler(async (req: Request, res: Response) => {
  const input = parseBody(createCustomerSchema, req.body);

  const customer = await prisma.$transaction(async (tx) => {
    const created = await tx.customer.create({
      data: {
        name: input.name,
        phone: input.phone ?? null,
        email: input.email ?? null,
        address: input.address ?? null,
        customerType: input.customerType,
        creditEligible: input.creditEligible,
        creditLimit: new Prisma.Decimal(input.creditLimit),
        status: input.status,
        branchId: req.user!.branchId,
      },
    });
    if (input.creditEligible) {
      await tx.creditAccount.upsert({
        where: { customerId: created.id },
        update: { creditLimit: new Prisma.Decimal(input.creditLimit), status: 'OPEN' },
        create: {
          customerId: created.id,
          branchId: req.user!.branchId,
          creditLimit: new Prisma.Decimal(input.creditLimit),
          status: 'OPEN',
        },
      });
    }
    return created;
  });

  await recordAudit({
    userId: req.user!.id,
    branchId: req.user!.branchId,
    action: 'CREATE',
    entityType: 'Customer',
    entityId: customer.id,
    newValue: scalarize(customer),
  });

  res.status(201).json({ data: customer });
});

export const updateCustomer = asyncHandler(async (req: Request, res: Response) => {
  const existing = await prisma.customer.findFirst({
    where: {
      id: paramId(req, 'id'),
      OR: [{ branchId: req.user!.branchId }, { branchId: null }],
    },
  });
  if (!existing) throw ApiError.notFound('Customer not found');

  const input = parseBody(updateCustomerSchema, req.body);
  const data: Prisma.CustomerUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.phone !== undefined) data.phone = input.phone;
  if (input.email !== undefined) data.email = input.email;
  if (input.address !== undefined) data.address = input.address;
  if (input.customerType !== undefined) data.customerType = input.customerType;
  if (input.creditEligible !== undefined) data.creditEligible = input.creditEligible;
  if (input.creditLimit !== undefined) data.creditLimit = new Prisma.Decimal(input.creditLimit);
  if (input.status !== undefined) data.status = input.status;

  const customer = await prisma.$transaction(async (tx) => {
    const updated = await tx.customer.update({ where: { id: existing.id }, data });
    if (updated.creditEligible) {
      await tx.creditAccount.upsert({
        where: { customerId: updated.id },
        update: {
          ...(input.creditLimit !== undefined
            ? { creditLimit: new Prisma.Decimal(input.creditLimit), status: 'OPEN' }
            : {}),
        },
        create: {
          customerId: updated.id,
          branchId: req.user!.branchId,
          creditLimit: new Prisma.Decimal(updated.creditLimit),
          status: 'OPEN',
        },
      });
    }
    return updated;
  });

  await recordAudit({
    userId: req.user!.id,
    branchId: req.user!.branchId,
    action: 'UPDATE',
    entityType: 'Customer',
    entityId: customer.id,
    previousValue: scalarize(existing),
    newValue: scalarize(customer),
  });

  res.json({ data: customer });
});

export const setCustomerStatus = asyncHandler(async (req: Request, res: Response) => {
  const existing = await prisma.customer.findFirst({
    where: {
      id: paramId(req, 'id'),
      OR: [{ branchId: req.user!.branchId }, { branchId: null }],
    },
  });
  if (!existing) throw ApiError.notFound('Customer not found');

  const { status } = updateCustomerSchema.pick({ status: true }).parse(req.body);
  const customer = await prisma.customer.update({ where: { id: existing.id }, data: { status } });

  await recordAudit({
    userId: req.user!.id,
    branchId: req.user!.branchId,
    action: 'UPDATE',
    entityType: 'Customer',
    entityId: customer.id,
    previousValue: { status: existing.status },
    newValue: { status },
  });

  res.json({ data: customer });
});

export const createCreditPayment = asyncHandler(async (req: Request, res: Response) => {
  const input = parseBody(creditPaymentSchema, req.body);
  const customerId = paramId(req, 'id');

  const account = await prisma.creditAccount.findFirst({
    where: { customerId, branchId: req.user!.branchId },
    include: { customer: { select: { name: true } } },
  });
  if (!account) throw ApiError.badRequest('This customer has no credit account');

  const amount = new Prisma.Decimal(input.amount);
  if (amount.lessThanOrEqualTo(0)) throw ApiError.badRequest('Amount must be greater than zero');
  if (amount.greaterThan(account.outstandingBalance)) {
    throw ApiError.badRequest('Payment exceeds the outstanding balance');
  }

  const payment = await prisma.$transaction(async (tx) => {
    const p = await tx.creditPayment.create({
      data: {
        creditAccountId: account.id,
        amount,
        method: input.method,
        reference: input.reference ?? null,
        paidAt: new Date(),
        createdById: req.user!.id,
        note: input.note ?? null,
      },
    });
    await tx.creditAccount.update({
      where: { id: account.id },
      data: { outstandingBalance: account.outstandingBalance.minus(amount) },
    });
    return p;
  });

  await recordAudit({
    userId: req.user!.id,
    branchId: req.user!.branchId,
    action: 'CREDIT_PAYMENT',
    entityType: 'CreditAccount',
    entityId: account.id,
    newValue: { amount: amount.toFixed(2), method: input.method, reference: input.reference },
  });

  res.status(201).json({
    data: {
      id: payment.id,
      amount: payment.amount,
      method: payment.method,
      outstandingBalance: account.outstandingBalance.minus(amount),
    },
  });
});