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
  EMAIL_PROVIDER: z.enum(['console', 'smtp']).default('console'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
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

const PLACEHOLDER_JWT = 'change-me-to-a-long-random-secret-at-least-32-chars';

if (parsed.data.NODE_ENV === 'production') {
  const problems: string[] = [];
  if (parsed.data.EMAIL_PROVIDER !== 'smtp') {
    problems.push('EMAIL_PROVIDER must be "smtp" in production (console mode is not allowed)');
  }
  if (!parsed.data.SMTP_HOST) {
    problems.push('SMTP_HOST is required in production');
  }
  if (
    parsed.data.JWT_SECRET === PLACEHOLDER_JWT ||
    /^(change-me|changeme|secret|your-)/i.test(parsed.data.JWT_SECRET)
  ) {
    problems.push('JWT_SECRET must be a unique random value in production (generate with `openssl rand -hex 64`)');
  }
  if (!parsed.data.CLIENT_ORIGIN.startsWith('https://')) {
    problems.push('CLIENT_ORIGIN must use https:// in production');
  }
  if (problems.length > 0) {
    console.error(
      'Invalid production environment configuration. Fix the following and restart:\n' +
        problems.map((p) => `  - ${p}`).join('\n'),
    );
    process.exit(1);
  }
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
  emailProvider: parsed.data.EMAIL_PROVIDER,
  smtp: {
    host: parsed.data.SMTP_HOST,
    port: parsed.data.SMTP_PORT,
    user: parsed.data.SMTP_USER,
    pass: parsed.data.SMTP_PASS,
    from: parsed.data.SMTP_FROM,
  },
} as const;
