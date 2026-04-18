import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().default('postgres://app:app@localhost:5432/app'),
  SESSION_SECRET: z
    .string()
    .min(32)
    .default('dev-only-session-secret-change-me-in-production-xxxxxxxxx'),
  STORAGE_ROOT: z.string().default('/data/attachments'),
  PRESENCE_SWEEP_INTERVAL_MS: z.coerce.number().int().positive().default(2000),
  PRESENCE_AFK_THRESHOLD_MS: z.coerce.number().int().positive().default(60_000),
  PRESENCE_TAB_GRACE_MS: z.coerce.number().int().positive().default(30_000),
});

export const config = schema.parse(process.env);
export type Config = typeof config;
