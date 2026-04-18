import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import cookie from '@fastify/cookie';
import { config } from './config.js';
import { pingDb, pool } from './db/client.js';
import { registerEchoWs } from './ws/echo.js';

const app = Fastify({
  logger: {
    level: config.NODE_ENV === 'production' ? 'info' : 'debug',
    transport:
      config.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  },
  disableRequestLogging: config.NODE_ENV === 'production',
});

await app.register(cookie);
await app.register(websocket);

app.get('/health', async () => {
  let dbOk = false;
  try {
    dbOk = await pingDb();
  } catch (err) {
    app.log.warn({ err }, 'db ping failed');
  }
  return { status: 'ok', db: dbOk, ts: Date.now() };
});

registerEchoWs(app);

const shutdown = async (signal: string): Promise<void> => {
  app.log.info({ signal }, 'shutting down');
  await app.close();
  await pool.end();
  process.exit(0);
};

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await app.listen({ host: config.HOST, port: config.PORT });
  app.log.info({ host: config.HOST, port: config.PORT }, 'api listening');
} catch (err) {
  app.log.error({ err }, 'failed to start');
  process.exit(1);
}
