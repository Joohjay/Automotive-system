import { z } from 'zod';

const PASSWORD_MIN = 8;
const PASSWORD_MESSAGE = 'Password must be at least 8 characters';

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(PASSWORD_MIN, PASSWORD_MESSAGE),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Enter a valid email address'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(PASSWORD_MIN, PASSWORD_MESSAGE),
});

export type LoginInput = z.infer<typeof loginSchema>;