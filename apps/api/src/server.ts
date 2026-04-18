import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import { config } from './config.js';
import { pingDb, pool } from './db/client.js';
import { runMigrations } from './db/migrate.js';
import { registerWsPlugin } from './ws/plugin.js';
import { registerAllRouteModules } from './routes/index.js';
import { sessionPlugin } from './session/plugin.js';

const loggerOptions =
  config.NODE_ENV === 'development'
    ? { level: 'debug', transport: { target: 'pino-pretty', options: { colorize: true } } }
    : { level: 'info' };

const app = Fastify({
  logger: loggerOptions,
  disableRequestLogging: config.NODE_ENV === 'production',
  // Trust the first proxy (nginx) for x-forwarded-for so rate-limiter and
  // session.ip see the real client IP instead of the proxy's internal address.
  trustProxy: 1,
});

// Security headers. CSP is off here because the api doesn't serve HTML — the
// frontend handles CSP via its nginx response headers. We still want X-Content-
// Type-Options, Referrer-Policy, Cross-Origin isolation, and the default set.
await app.register(helmet, {
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
});

await app.register(cookie, { secret: config.SESSION_SECRET });
await app.register(sessionPlugin);
await app.register(websocket);

// Uniform error shape for any uncaught error. Feature routes should still
// return specific structured errors; this is the last-resort wrapper.
app.setErrorHandler((err: unknown, req, reply) => {
  const error = err as { statusCode?: number; code?: string; message?: string };
  const status = error.statusCode ?? 500;
  if (status >= 500) {
    req.log.error({ err }, 'unhandled route error');
  }
  const code = error.code ?? (status >= 500 ? 'internal_error' : 'error');
  reply.code(status).send({
    error: code,
    message: status >= 500 ? 'internal error' : (error.message ?? 'error'),
  });
});

app.get('/health', async () => {
  let dbOk = false;
  try {
    dbOk = await pingDb();
  } catch (err) {
    app.log.warn({ err }, 'db ping failed');
  }
  return { status: 'ok', db: dbOk, ts: Date.now() };
});

registerWsPlugin(app);
await registerAllRouteModules(app);

const shutdown = async (signal: string): Promise<void> => {
  app.log.info({ signal }, 'shutting down');
  await app.close();
  await pool.end();
  process.exit(0);
};

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

try {
  app.log.info('running migrations');
  await runMigrations();
  app.log.info('migrations applied');
  await app.listen({ host: config.HOST, port: config.PORT });
  app.log.info({ host: config.HOST, port: config.PORT }, 'api listening');
} catch (err) {
  app.log.error({ err }, 'failed to start');
  process.exit(1);
}
