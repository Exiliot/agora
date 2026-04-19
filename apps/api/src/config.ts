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

  // Absolute URL the web app is reachable at. Used to build the password-
  // reset link that the mocked-email flow logs to stdout. Defaults to the
  // docker-compose web port; override when running behind a real hostname.
  APP_BASE_URL: z.string().url().default('http://localhost:8080'),

  // Additional allowed Origins for the WS upgrade handshake, comma-separated.
  // APP_BASE_URL is always allowed implicitly. Extra origins land here for dev
  // hot-reload servers running on a different port.
  WS_ALLOWED_ORIGINS: z.string().default(''),

  // When '1', the password-reset endpoint logs the single-use link to stdout
  // with the [AUTH reset link] tag. Required for the hackathon demo because
  // there is no mailer wired; a production deployment that sets up a real
  // mailer keeps this off. See ADR-0010.
  AGORA_DEMO_MODE: z.enum(['0', '1']).default('0'),

  // Postgres pool max. 10 was the default and became a hot-path bottleneck
  // at the 300-concurrent-users target (NFR-CAP-1) because a first-page
  // load fires ~5 parallel queries per user. 30 covers that comfortably in
  // one node process without exhausting pg's default max_connections=100.
  PG_POOL_MAX: z.coerce.number().int().positive().default(30),

  // Don't issue a session-sliding UPDATE on every authenticated request.
  // Per-session in-memory timestamp throttles the write to once every
  // SESSION_TOUCH_MIN_INTERVAL_MS per session.
  SESSION_TOUCH_MIN_INTERVAL_MS: z.coerce.number().int().nonnegative().default(60_000),
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
