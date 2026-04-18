/**
 * Dev-only helpers for load-testing and seeding. Gated behind
 * `ALLOW_DEV_SEED=1`. Never enable in production — it lets any authenticated
 * user create arbitrary history.
 */

import type { FastifyInstance } from 'fastify';
import { uuidv7 } from 'uuidv7';
import { z } from 'zod';
import { config } from '../config.js';
import { db } from '../db/client.js';
import { messages } from '../db/schema.js';
import { addRouteModule } from '../routes/registry.js';
import { requireAuth } from '../session/require-auth.js';
import { canAccessDm, canAccessRoom } from '../messages/permissions.js';

const seedBody = z.object({
  conversationType: z.enum(['room', 'dm']),
  conversationId: z.string().uuid(),
  count: z.number().int().min(1).max(20000),
});

addRouteModule({
  name: 'dev',
  register(app: FastifyInstance) {
    if (config.ALLOW_DEV_SEED !== '1') {
      app.log.info('dev routes disabled (set ALLOW_DEV_SEED=1 to enable)');
      return;
    }

    app.register(async (scoped) => {
      scoped.addHook('onRequest', requireAuth);

      scoped.post('/api/dev/seed-messages', async (req, reply) => {
        if (!req.user) return reply.code(401).send({ error: 'unauthenticated' });
        const parsed = seedBody.safeParse(req.body);
        if (!parsed.success) {
          return reply.code(400).send({ error: 'validation', issues: parsed.error.issues });
        }
        const { conversationType, conversationId, count } = parsed.data;

        // Permission check — caller must actually belong to the conversation.
        const allowed =
          conversationType === 'room'
            ? (await canAccessRoom(req.user.id, conversationId)).ok
            : (await canAccessDm(req.user.id, conversationId)).ok;
        if (!allowed) return reply.code(403).send({ error: 'forbidden' });

        const now = Date.now();
        const BATCH = 500;
        let inserted = 0;
        let latestId: string | null = null;

        for (let offset = 0; offset < count; offset += BATCH) {
          const slice = Math.min(BATCH, count - offset);
          const values = Array.from({ length: slice }, (_, i) => {
            // Spread timestamps across the past so k-sorted ids grow forward.
            const createdAt = new Date(now - (count - (offset + i)) * 1000);
            const id = uuidv7();
            latestId = id;
            return {
              id,
              conversationType,
              conversationId,
              authorId: req.user!.id,
              body: `seeded message ${offset + i + 1}`,
              createdAt,
            };
          });
          await db.insert(messages).values(values);
          inserted += slice;
        }

        return reply.send({ inserted, latestId });
      });
    });
  },
});
