import { z } from 'zod';

const id = z.string().min(1, 'Required');
const money = z.coerce.number().nonnegative('Must be zero or more');

export const purchaseItemSchema = z.object({
  productId: id,
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1'),
  unitCost: money,
});

export const createPurchaseSchema = z.object({
  supplierId: id,
  reference: z.string().trim().min(1, 'Reference/invoice no is required').max(100),
  purchaseDate: z.coerce.date().default(() => new Date()),
  discount: money.default(0),
  notes: z.string().max(2000).nullable().optional(),
  items: z.array(purchaseItemSchema).min(1, 'At least one item is required').max(500),
});

export const purchaseQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(['PENDING', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED']).optional(),
  supplierId: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const receivePurchaseSchema = z.object({
  locationId: id,
  items: z
    .array(z.object({ itemId: id, quantity: z.coerce.number().int().min(1) }))
    .min(1, 'Select at least one item to receive')
    .max(500),
});

export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;
export type ReceivePurchaseInput = z.infer<typeof receivePurchaseSchema>;