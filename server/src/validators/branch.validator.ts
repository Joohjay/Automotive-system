import { z } from 'zod';

export const createBranchSchema = z.object({
  name: z.string().min(1, 'Branch name is required').max(200),
  code: z.string().min(1, 'Branch code is required').max(50).transform(s => s.toUpperCase()),
  address: z.string().max(500).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().email().optional().nullable(),
});

export const updateBranchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  code: z.string().min(1).max(50).transform(s => s.toUpperCase()).optional(),
  address: z.string().max(500).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().email().optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});
