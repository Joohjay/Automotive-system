import type { z } from 'zod';

import { ApiError } from '../middleware/error.js';

export function parseBody<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  data: unknown,
): z.output<TSchema> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw ApiError.badRequest('Invalid request data', result.error.flatten());
  }
  return result.data;
}

export function parseQuery<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  data: unknown,
): z.output<TSchema> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw ApiError.badRequest('Invalid query parameters', result.error.flatten());
  }
  return result.data;
}

/** Normalises a route parameter (Express 5 types params as string | string[]). */
export function paramId(req: { params: Record<string, unknown> }, name: string): string {
  const value = req.params[name];
  if (Array.isArray(value)) return String(value[0] ?? '');
  return typeof value === 'string' ? value : String(value ?? '');
}