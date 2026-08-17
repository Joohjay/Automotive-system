import { z } from 'zod';

const money = z.coerce.number().nonnegative('Must be zero or more');

export const openShiftSchema = z.object({
  openingCash: money.default(0),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export const closeShiftSchema = z.object({
  actualClosingCash: money,
  notes: z.string().trim().max(2000).nullable().optional(),
});

export const shiftQuerySchema = z.object({
  status: z.enum(['OPEN', 'CLOSED']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type OpenShiftInput = z.infer<typeof openShiftSchema>;
export type CloseShiftInput = z.infer<typeof closeShiftSchema>;
