import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { clientToServerEvent } from '@agora/shared';
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
import { userTopic } from '../bus/topics.js';

export interface AuthedUser {
  id: string;
  username: string;
}

const extractUser = (req: FastifyRequest): AuthedUser | null => {
  if (!req.user) return null;
  return { id: req.user.id, username: req.user.username };
};

export const registerWsPlugin = (app: FastifyInstance): void => {
  app.get('/ws', { websocket: true }, (socket, req) => {
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
      if (e.type === 'subscribe') {
        subscribeConnection(conn, e.payload.topic);
        conn.send({ type: 'ack', payload: { reqId: e.reqId } });
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
      connectionLifecycle.emit('close', conn);
      unsubscribeAll(conn);
      connections.remove(conn);
      app.log.debug({ connId: conn.id, userId: user.id }, 'ws disconnected');
    });
  });
};
