import { z } from 'zod';

const id = z.string().min(1, 'Required');
const money = z.coerce.number().nonnegative('Must be zero or more');

export const createExpenseCategorySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  description: z.string().trim().max(500).nullable().optional(),
});

export const updateExpenseCategorySchema = createExpenseCategorySchema.partial();

export const createExpenseSchema = z.object({
  categoryId: id,
  description: z.string().trim().min(1, 'Description is required').max(500),
  amount: money.refine((v) => v > 0, 'Amount must be greater than zero'),
  expenseDate: z.coerce.date().optional(),
  paymentMethod: z.enum(['CASH', 'MPESA', 'CREDIT', 'OTHER']).default('CASH'),
  reference: z.string().trim().max(200).nullable().optional(),
  note: z.string().trim().max(2000).nullable().optional(),
});

export const expenseQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  categoryId: z.string().optional(),
  paymentMethod: z.enum(['CASH', 'MPESA', 'CREDIT', 'OTHER']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type CreateExpenseCategoryInput = z.infer<typeof createExpenseCategorySchema>;
