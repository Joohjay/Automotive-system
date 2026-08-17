import { z } from 'zod';

const id = z.string().min(1, 'Required');
const money = z.coerce.number();

export const createLoanSchema = z.object({
  lender: z.string().trim().min(1, 'Lender is required').max(200),
  reference: z.string().trim().max(200).nullable().optional(),
  principalAmount: money.refine((v) => v > 0, 'Principal must be greater than zero'),
  interestRate: money.default(0),
  interestMethod: z.enum(['FLAT', 'REDUCING_BALANCE', 'FIXED_SCHEDULE']).default('FLAT'),
  durationMonths: z.coerce.number().int().min(0).default(0),
  startDate: z.coerce.date().optional(),
  maturityDate: z.coerce.date().nullable().optional(),
  totalExpectedInterest: money.default(0),
  totalRepayment: money.default(0),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export const updateLoanSchema = z.object({
  lender: z.string().trim().min(1).max(200).optional(),
  reference: z.string().trim().max(200).nullable().optional(),
  interestRate: money.optional(),
  interestMethod: z.enum(['FLAT', 'REDUCING_BALANCE', 'FIXED_SCHEDULE']).optional(),
  durationMonths: z.coerce.number().int().min(0).optional(),
  maturityDate: z.coerce.date().nullable().optional(),
  totalExpectedInterest: money.optional(),
  totalRepayment: money.optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export const loanPaymentSchema = z.object({
  amount: money.refine((v) => v > 0, 'Amount must be greater than zero'),
  scheduleId: id.nullable().optional(),
  method: z.enum(['CASH', 'MPESA', 'CREDIT', 'OTHER']).default('CASH'),
  reference: z.string().trim().max(200).nullable().optional(),
  note: z.string().trim().max(2000).nullable().optional(),
  paymentDate: z.coerce.date().optional(),
});

export const loanScheduleItemSchema = z.object({
  installmentNo: z.coerce.number().int().min(1),
  dueDate: z.coerce.date(),
  principalAmount: money,
  interestAmount: money.default(0),
  totalDue: money,
});

export const generateScheduleSchema = z.object({
  installments: z.array(loanScheduleItemSchema).min(1, 'Add at least one installment').max(120),
});

export const loanQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(['ACTIVE', 'CLOSED', 'DEFAULTED', 'CANCELLED']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateLoanInput = z.infer<typeof createLoanSchema>;
export type LoanPaymentInput = z.infer<typeof loanPaymentSchema>;
