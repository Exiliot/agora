/**
 * HTTP routes for the notifications feature. The notifications feed is the
 * bell-icon data: newest-first list, unread count, and the two mark-as-read
 * actions. Live updates come over WS (`notification.created`, `.read`,
 * `.read_all`) from the publisher and these routes.
 */

import type { FastifyInstance } from 'fastify';
import { and, eq, isNull, lt, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client.js';
import { notifications } from '../db/schema.js';
import { bus } from '../bus/bus.js';
import { userTopic } from '../bus/topics.js';
import { addRouteModule } from '../routes/registry.js';
import { isAuthed, requireAuth } from '../session/require-auth.js';
import { actor, hydrateSelection, rowToView } from './hydrate.js';

const feedQuery = z.object({
  before: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

addRouteModule({
  name: 'notifications',
  register(app: FastifyInstance): void {
    app.register(async (scoped) => {
      scoped.addHook('onRequest', requireAuth);

      scoped.get('/api/notifications', async (req, reply) => {
        if (!isAuthed(req)) return;
        const parsed = feedQuery.safeParse(req.query);
        if (!parsed.success) {
          return reply.code(400).send({ error: 'validation' });
        }
        const limit = parsed.data.limit ?? 30;
        const conditions = [eq(notifications.userId, req.user.id)];
        if (parsed.data.before) {
          conditions.push(lt(notifications.id, parsed.data.before));
        }
        const rows = await db
          .select(hydrateSelection)
          .from(notifications)
          .leftJoin(actor, eq(actor.id, notifications.actorUserId))
          .where(and(...conditions))
          .orderBy(sql`${notifications.id} DESC`)
          .limit(limit);
        return reply.send({ notifications: rows.map(rowToView) });
      });

      scoped.get('/api/notifications/unread-count', async (req, reply) => {
        if (!isAuthed(req)) return;
        const [row] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(notifications)
          .where(and(eq(notifications.userId, req.user.id), isNull(notifications.readAt)));
        return reply.send({ count: row?.count ?? 0 });
      });

      scoped.post<{ Params: { id: string } }>(
        '/api/notifications/:id/read',
        async (req, reply) => {
          if (!isAuthed(req)) return;
          const updated = await db
            .update(notifications)
            .set({ readAt: new Date() })
            .where(
              and(
                eq(notifications.id, req.params.id),
                eq(notifications.userId, req.user.id),
                isNull(notifications.readAt),
              ),
            )
            .returning({ id: notifications.id });
          if (updated.length === 0) {
            return reply.code(404).send({ error: 'not_found' });
          }
          bus.publish(userTopic(req.user.id), {
            type: 'notification.read',
            payload: { id: req.params.id },
          });
          return reply.code(204).send();
        },
      );

      scoped.post('/api/notifications/read-all', async (req, reply) => {
        if (!isAuthed(req)) return;
        await db
          .update(notifications)
          .set({ readAt: new Date() })
          .where(
            and(
              eq(notifications.userId, req.user.id),
              isNull(notifications.readAt),
            ),
          );
        bus.publish(userTopic(req.user.id), {
          type: 'notification.read_all',
          payload: {},
        });
        return reply.code(204).send();
      });
    });
  },
});
