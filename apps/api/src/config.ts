import { randomBytes } from 'node:crypto';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().default('postgres://app:app@localhost:5432/app'),
  SESSION_SECRET: z.string().min(32).optional(),
  STORAGE_ROOT: z.string().default('/data/attachments'),
  PRESENCE_SWEEP_INTERVAL_MS: z.coerce.number().int().positive().default(2000),
  PRESENCE_AFK_THRESHOLD_MS: z.coerce.number().int().positive().default(60_000),
  PRESENCE_TAB_GRACE_MS: z.coerce.number().int().positive().default(30_000),
  ALLOW_DEV_SEED: z.enum(['0', '1']).default('0'),
  ENABLE_XMPP_BRIDGE: z.enum(['0', '1']).default('0'),
});

const parsed = schema.parse(process.env);

// Session secret: must not fall back to a committed default. If the operator
// didn't supply one, generate a random 48-byte secret at boot. Sessions are
// invalidated on every restart in this mode — acceptable for the demo, not
// for production. Log a warning either way.
let sessionSecret = parsed.SESSION_SECRET;
if (!sessionSecret) {
  sessionSecret = randomBytes(48).toString('base64url');
  // eslint-disable-next-line no-console
  console.warn(
    '[config] SESSION_SECRET not provided — generated a random one; existing sessions will not survive restarts',
  );
}

export const config = { ...parsed, SESSION_SECRET: sessionSecret };
export type Config = typeof config;
