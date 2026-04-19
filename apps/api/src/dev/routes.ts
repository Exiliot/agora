/**
 * Dev-only helpers for load-testing and seeding. Gated behind
 * `ALLOW_DEV_SEED=1`. Never enable in production — it lets any authenticated
 * user create arbitrary history, and any unauthenticated caller to pre-
 * provision users in bulk.
 */

import type { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import { z } from 'zod';
import { config } from '../config.js';
import { db } from '../db/client.js';
import { messages, users } from '../db/schema.js';
import { addRouteModule } from '../routes/registry.js';
import { requireAuth } from '../session/require-auth.js';
import { canAccessDm, canAccessRoom } from '../messages/permissions.js';
import { hashPassword } from '../auth/password.js';

const seedBody = z.object({
  conversationType: z.enum(['room', 'dm']),
  conversationId: z.string().uuid(),
  count: z.number().int().min(1).max(20000),
});

const bulkRegisterBody = z.object({
  prefix: z
    .string()
    .min(2)
    .max(24)
    .regex(/^[a-z][a-z0-9._-]*$/, 'prefix must match username rules'),
  count: z.number().int().min(1).max(2000),
  password: z.string().min(8).default('password123'),
});

addRouteModule({
  name: 'dev',
  register(app: FastifyInstance) {
    if (config.ALLOW_DEV_SEED !== '1') {
      app.log.info('dev routes disabled (set ALLOW_DEV_SEED=1 to enable)');
      return;
    }

    // Loud, one-time warning on boot so an operator who sets ALLOW_DEV_SEED=1
    // by accident (or forgets it in a compose override) sees it at startup
    // rather than discovering the unauthenticated bulk-register endpoint by
    // other means. NODE_ENV=production with ALLOW_DEV_SEED=1 is a misconfig.
    app.log.warn(
      { nodeEnv: config.NODE_ENV },
      'dev routes ENABLED (ALLOW_DEV_SEED=1) — bulk-register is unauthenticated; never run with NODE_ENV=production',
    );
    if (config.NODE_ENV === 'production') {
      app.log.error(
        'ALLOW_DEV_SEED=1 with NODE_ENV=production is a misconfiguration; dev routes remain mounted but this will be refused in a future release',
      );
    }

    // Bulk-register is NOT behind requireAuth — load tests start with no
    // accounts. It is gated behind the same ALLOW_DEV_SEED flag and is a
    // deliberate dev-only escape hatch for rate-limited registration.
    app.post('/api/dev/bulk-register', async (req, reply) => {
      const parsed = bulkRegisterBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'validation', issues: parsed.error.issues });
      }
      const { prefix, count, password } = parsed.data;
      const passwordHash = await hashPassword(password);
      const now = new Date();

      const values = Array.from({ length: count }, (_, i) => {
        const username = `${prefix}${i}`;
        return {
          id: uuidv7(),
          email: `${username}@load.test`,
          username,
          passwordHash,
          createdAt: now,
          updatedAt: now,
        };
      });

      const inserted = await db
        .insert(users)
        .values(values)
        .onConflictDoNothing()
        .returning({ username: users.username });

      return reply.send({ inserted: inserted.length, usernames: inserted.map((u) => u.username) });
    });

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
