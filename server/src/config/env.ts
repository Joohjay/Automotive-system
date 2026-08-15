import 'dotenv/config';

import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required. See server/.env.example'),
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('8h'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');

  console.error(
    'Invalid environment configuration. Fix the following and restart:\n' +
      issues,
  );
  process.exit(1);
}

export const config = {
  env: parsed.data.NODE_ENV,
  port: parsed.data.PORT,
  clientOrigin: parsed.data.CLIENT_ORIGIN,
  isDevelopment: parsed.data.NODE_ENV === 'development',
  isProduction: parsed.data.NODE_ENV === 'production',
  jwt: {
    secret: parsed.data.JWT_SECRET,
    expiresIn: parsed.data.JWT_EXPIRES_IN,
  },
} as const;
