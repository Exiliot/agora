import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { clientToServerEvent } from '@agora/shared';
import { config } from '../config.js';
import {
  connections,
  createConnection,
  subscribeConnection,
  unsubscribeAll,
  unsubscribeConnection,
  type WsConnection,
} from './connection-manager.js';
import { dispatchWsEvent } from './dispatcher.js';
import { connectionLifecycle } from './lifecycle.js';
import { canSubscribeToTopic } from './topic-acl.js';
import { userFocusRegistry } from './user-focus.js';
import { userTopic } from '../bus/topics.js';

export interface AuthedUser {
  id: string;
  username: string;
}

const extractUser = (req: FastifyRequest): AuthedUser | null => {
  if (!req.user) return null;
  return { id: req.user.id, username: req.user.username };
};

const parseAllowedOrigins = (): Set<string> => {
  const base = new URL(config.APP_BASE_URL).origin;
  const extras = config.WS_ALLOWED_ORIGINS
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return new Set([base, ...extras]);
};

const allowedOrigins = parseAllowedOrigins();

const isAllowedOrigin = (origin: string | undefined): boolean => {
  if (!origin) return false;
  if (origin === 'null') return false;
  return allowedOrigins.has(origin);
};

export const registerWsPlugin = (app: FastifyInstance): void => {
  app.get('/ws', { websocket: true }, (socket, req) => {
    const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
    if (!isAllowedOrigin(origin)) {
      app.log.warn(
        { origin, ip: req.ip },
        'ws upgrade rejected: forbidden origin',
      );
      socket.close(4403, 'forbidden_origin');
      return;
    }

    const user = extractUser(req);
    if (!user) {
      // Unauthenticated WS connection — close immediately with application code 4401.
      socket.close(4401, 'unauthenticated');
      return;
    }

    const conn: WsConnection = createConnection({
      id: randomUUID(),
      userId: user.id,
      socket,
    });

    connections.add(conn);
    subscribeConnection(conn, userTopic(user.id));

    app.log.debug({ connId: conn.id, userId: user.id }, 'ws connected');

    // Application-level ping/pong so silent half-open connections (NAT
    // timeouts, mobile OS suspension behind nginx's 1h read timeout) get
    // detected within ~60s. The `ws` library handles pong frames natively
    // so we only need to fire pings and terminate on missed pong.
    let alive = true;
    const ping = setInterval(() => {
      if (!alive) {
        socket.terminate();
        return;
      }
      alive = false;
      try {
        socket.ping();
      } catch {
        /* ignore; next tick will detect death */
      }
    }, 30_000);
    socket.on('pong', () => {
      alive = true;
    });

    socket.on('message', (raw) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw.toString());
      } catch {
        conn.send({
          type: 'err',
          payload: { code: 'validation', message: 'invalid JSON' },
        });
        return;
      }

      const event = clientToServerEvent.safeParse(parsed);
      if (!event.success) {
        conn.send({
          type: 'err',
          payload: {
            code: 'validation',
            message: event.error.issues[0]?.message ?? 'invalid event',
          },
        });
        return;
      }

      // Built-in handlers for plumbing events: hello, subscribe, unsubscribe,
      // heartbeat. Feature events (message.send, mark.read, …) are routed to
      // the dispatcher and handled by feature modules.
      const e = event.data;
      if (e.type === 'hello') {
        conn.tabId = e.payload.tabId;
        connectionLifecycle.emit('hello', conn);
        conn.send({ type: 'ack', payload: { reqId: e.reqId, result: { hello: 'ok' } } });
        return;
      }
      if (e.type === 'heartbeat') {
        // Presence feature subscribes to heartbeats via the dispatcher registration.
        void dispatchWsEvent({ conn }, e);
        return;
      }
      if (e.type === 'client.focus') {
        if (e.payload.subjectType === null || e.payload.subjectId === null) {
          userFocusRegistry.clear(conn.userId);
        } else {
          userFocusRegistry.set(conn.userId, e.payload.subjectType, e.payload.subjectId);
        }
        return;
      }
      if (e.type === 'subscribe') {
        const topic = e.payload.topic;
        const reqId = e.reqId;
        void (async () => {
          if (!(await canSubscribeToTopic(conn.userId, topic))) {
            conn.send({
              type: 'err',
              payload: { reqId, code: 'forbidden', message: 'cannot subscribe' },
            });
            return;
          }
          subscribeConnection(conn, topic);
          conn.send({ type: 'ack', payload: { reqId } });
        })();
        return;
      }
      if (e.type === 'unsubscribe') {
        unsubscribeConnection(conn, e.payload.topic);
        conn.send({ type: 'ack', payload: { reqId: e.reqId } });
        return;
      }

      void dispatchWsEvent({ conn }, e);
    });

    socket.on('close', () => {
      clearInterval(ping);
      connectionLifecycle.emit('close', conn);
      unsubscribeAll(conn);
      connections.remove(conn);
      if (connections.forUser(user.id).length === 0) {
        userFocusRegistry.clear(user.id);
      }
      app.log.debug({ connId: conn.id, userId: user.id }, 'ws disconnected');
    });
  });
};
