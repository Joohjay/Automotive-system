import { z } from 'zod';

export const mfaVerifySchema = z.object({
  token: z.string().trim().length(6, 'MFA code must be exactly 6 digits').regex(/^\d{6}$/, 'MFA code must be 6 digits'),
});

export const mfaSetupSchema = z.object({
  password: z.string().min(1, 'Password is required to enable MFA'),
});

export type MfaVerifyInput = z.infer<typeof mfaVerifySchema>;
export type MfaSetupInput = z.infer<typeof mfaSetupSchema>;
