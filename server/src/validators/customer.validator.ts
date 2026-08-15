import { z } from 'zod';

const money = z.coerce.number().nonnegative('Must be zero or more');

const optionalString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const createCustomerSchema = z.object({
  name: z.string().trim().min(1, 'Customer name is required').max(200),
  phone: optionalString(30),
  email: z
    .union([z.literal(''), z.string().trim().max(200).email('Invalid email address')])
    .optional()
    .transform((v) => (v ? v : null)),
  address: optionalString(500),
  customerType: z.enum(['RETAIL', 'WHOLESALE']).default('RETAIL'),
  creditEligible: z.boolean().default(false),
  creditLimit: money.default(0),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export const customerQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const creditPaymentSchema = z.object({
  amount: money,
  method: z.enum(['CASH', 'MPESA', 'OTHER']).default('CASH'),
  reference: z.string().trim().max(200).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;