import { z } from 'zod';

const optionalString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const createSupplierSchema = z.object({
  name: z.string().trim().min(1, 'Supplier name is required').max(200),
  contactPerson: optionalString(100),
  phone: optionalString(30),
  email: z
    .union([z.literal(''), z.string().trim().max(200).email('Invalid email address')])
    .optional()
    .transform((v) => (v ? v : null)),
  address: optionalString(500),
  taxNumber: optionalString(50),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});

export const updateSupplierSchema = createSupplierSchema.partial();

export const supplierQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;