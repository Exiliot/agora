/**
 * HTTP routes for listing and revoking the caller's authentication sessions.
 * See docs/requirements/02-sessions-presence.md.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { SessionView } from '@agora/shared';
import { addRouteModule } from '../routes/registry.js';
import { clearSessionCookie } from '../session/cookie.js';
import { requireAuth } from '../session/require-auth.js';
import { deleteSession, listSessionsForUser, type SessionRecord } from '../session/store.js';

const revokeParams = z.object({ id: z.string().uuid() });

const toSessionView = (record: SessionRecord, currentSessionId: string): SessionView => ({
  id: record.id,
  userAgent: record.userAgent,
  ip: record.ip,
  createdAt: record.createdAt.toISOString(),
  lastSeenAt: record.lastSeenAt.toISOString(),
  expiresAt: record.expiresAt.toISOString(),
  isCurrent: record.id === currentSessionId,
});

addRouteModule({
  name: 'sessions',
  register(app: FastifyInstance) {
    app.get('/api/sessions', { onRequest: requireAuth }, async (req, reply) => {
      const user = req.user;
      const session = req.session;
      if (!user || !session) return reply.code(401).send({ error: 'unauthenticated' });

      const records = await listSessionsForUser(user.id);
      const items = records.map((record) => toSessionView(record, session.id));
      return reply.code(200).send({ sessions: items });
    });

    app.delete('/api/sessions/:id', { onRequest: requireAuth }, async (req, reply) => {
      const parsed = revokeParams.safeParse(req.params);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid_input', issues: parsed.error.issues });
      }
      const user = req.user;
      const session = req.session;
      if (!user || !session) return reply.code(401).send({ error: 'unauthenticated' });

      const removed = await deleteSession(parsed.data.id, user.id);
      if (!removed) {
        return reply.code(404).send({ error: 'not_found', message: 'session not found' });
      }

      if (parsed.data.id === session.id) {
        clearSessionCookie(reply);
      }
      return reply.code(204).send();
    });
  },
});
