import { z } from 'zod';

const id = z.string().min(1, 'Required');
const money = z.coerce.number().nonnegative('Must be zero or more');

export const productBase = {
  name: z.string().min(1, 'Product name is required').max(200),
  sku: z.string().min(1, 'SKU is required').max(50),
  partNumber: z.string().max(100).nullable().optional(),
  categoryId: id,
  brandId: id.nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  compatibility: z.string().max(2000).nullable().optional(),
  purchasePrice: money,
  sellingPrice: money,
  minStockLevel: z.coerce.number().int().min(0).default(0),
  reorderQty: z.coerce.number().int().min(0).default(0),
  unitOfMeasure: z.string().min(1, 'Unit is required').max(20),
  barcode: z.string().max(100).nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
};

export const createProductSchema = z.object(productBase);
export const updateProductSchema = z.object(productBase).partial();

export const productQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  categoryId: z.string().optional(),
  brandId: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;