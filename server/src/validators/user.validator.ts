import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.string().email('Valid email is required'),
  fullName: z.string().min(1, 'Full name is required').max(200),
  phone: z.string().max(50).optional().nullable(),
  roleId: z.string().min(1, 'Role is required'),
  branchId: z.string().min(1, 'Branch is required'),
  password: z.string().min(12, 'Password must be at least 12 characters'),
});

export const updateUserSchema = z.object({
  email: z.string().email().optional(),
  fullName: z.string().min(1).max(200).optional(),
  phone: z.string().max(50).optional().nullable(),
  roleId: z.string().optional(),
  branchId: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const userListQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  roleId: z.string().optional(),
  branchId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const adminResetPasswordSchema = z.object({
  newPassword: z.string().min(12, 'Password must be at least 12 characters'),
});
