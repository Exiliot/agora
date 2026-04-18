import type { FastifyInstance } from 'fastify';
import { clientToServerEvent } from '@agora/shared';

export const registerEchoWs = (app: FastifyInstance): void => {
  app.get('/ws', { websocket: true }, (socket) => {
    socket.on('message', (raw) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw.toString());
      } catch {
        socket.send(
          JSON.stringify({ type: 'err', code: 'validation', message: 'invalid JSON' }),
        );
        return;
      }

      const event = clientToServerEvent.safeParse(parsed);
      if (!event.success) {
        socket.send(
          JSON.stringify({
            type: 'err',
            code: 'validation',
            message: event.error.issues[0]?.message ?? 'invalid event',
          }),
        );
        return;
      }

      const msg = event.data;
      if (msg.type === 'hello') {
        socket.send(JSON.stringify({ type: 'ack', reqId: msg.reqId, result: { hello: 'ok' } }));
        return;
      }
      if (msg.type === 'heartbeat') {
        return;
      }
      if (msg.type === 'echo') {
        socket.send(
          JSON.stringify({
            type: 'ack',
            reqId: msg.reqId,
            result: { text: msg.payload.text, ts: Date.now() },
          }),
        );
        return;
      }
    });
  });
};
