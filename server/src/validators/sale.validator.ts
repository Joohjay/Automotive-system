import { z } from 'zod';

const id = z.string().min(1, 'Required');
const money = z.coerce.number().nonnegative('Must be zero or more');

export const saleItemSchema = z.object({
  productId: id,
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1'),
  // unitPrice is always taken from the product catalog — no client override allowed
  discount: money.optional().default(0),
});

export const salePaymentSchema = z.object({
  method: z.enum(['CASH', 'MPESA', 'CREDIT', 'OTHER']),
  amount: money,
  reference: z.string().trim().max(200).nullable().optional(),
});

export const createSaleSchema = z.object({
  items: z.array(saleItemSchema).min(1, 'Add at least one item').max(200),
  discount: money.default(0),
  customerId: id.nullable().optional(),
  locationId: id.optional(),
  payments: z.array(salePaymentSchema).min(1, 'At least one payment is required').max(10),
  notes: z.string().max(2000).nullable().optional(),
});

export const saleQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(['PENDING', 'COMPLETED', 'VOID']).optional(),
  customerId: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const voidSaleSchema = z.object({
  reason: z.string().trim().max(500).nullable().optional(),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;