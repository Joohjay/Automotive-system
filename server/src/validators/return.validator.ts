import { z } from 'zod';

const id = z.string().min(1, 'Required');
const money = z.coerce.number().nonnegative('Must be zero or more');

export const returnItemSchema = z.object({
  productId: id,
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1'),
  reason: z.string().max(500).nullable().optional(),
  condition: z.enum(['NEW', 'DAMAGED']).default('NEW'),
  stockTreatment: z.enum(['RESTOCK', 'DAMAGE', 'DISCARD', 'DONATE']).default('RESTOCK'),
});

export const createReturnSchema = z.object({
  saleId: id.nullable().optional(),
  customerId: id.nullable().optional(),
  locationId: id.optional(),
  reason: z.string().max(2000).nullable().optional(),
  refundMethod: z.enum(['CASH', 'MPESA', 'CREDIT', 'OTHER']).default('CASH'),
  items: z.array(returnItemSchema).min(1, 'Add at least one item').max(200),
});

export const returnQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(['PENDING', 'COMPLETED', 'CANCELLED']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateReturnInput = z.infer<typeof createReturnSchema>;