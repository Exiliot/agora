/**
 * Internal endpoints used by the XMPP sidecar. Delegated authentication is
 * handled here: Prosody POSTs credentials, we validate against the same
 * argon2id-hashed password store the web auth uses.
 *
 * Only mounted in Phase 2 topology — gated behind `ENABLE_XMPP_BRIDGE=1`.
 */

import type { FastifyInstance } from 'fastify';
import formbody from '@fastify/formbody';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { addRouteModule } from '../routes/registry.js';
import { verifyPassword } from '../auth/password.js';
import { config } from '../config.js';

// mod_auth_http posts form-urlencoded `user=...&pass=...`. We also accept
// JSON with the same keys (or `username`/`password`) to be forgiving.
const authBody = z
  .object({
    user: z.string().min(1).optional(),
    pass: z.string().min(1).optional(),
    username: z.string().min(1).optional(),
    password: z.string().min(1).optional(),
  })
  .refine((v) => (v.user ?? v.username) && (v.pass ?? v.password), {
    message: 'missing user/pass',
  });

addRouteModule({
  name: 'xmpp',
  register(app: FastifyInstance) {
    if (config.ENABLE_XMPP_BRIDGE !== '1') {
      app.log.info('xmpp bridge disabled (set ENABLE_XMPP_BRIDGE=1 to enable)');
      return;
    }

    app.register(async (scoped) => {
      await scoped.register(formbody);

      scoped.post('/internal/xmpp/auth', async (req, reply) => {
        const parsed = authBody.safeParse(req.body);
        if (!parsed.success) return reply.code(400).send({ error: 'validation' });

        const rawUser = parsed.data.user ?? parsed.data.username ?? '';
        const rawPass = parsed.data.pass ?? parsed.data.password ?? '';
        const local = rawUser.split('@')[0]?.toLowerCase() ?? '';
        if (!local || !rawPass) return reply.code(401).send({ error: 'invalid' });

        const rows = await db
          .select({ id: users.id, passwordHash: users.passwordHash, deletedAt: users.deletedAt })
          .from(users)
          .where(sql`lower(${users.username}) = ${local}`)
          .limit(1);
        const row = rows[0];
        if (!row || row.deletedAt) return reply.code(401).send({ error: 'invalid' });

        const ok = await verifyPassword(rawPass, row.passwordHash).catch(() => false);
        if (!ok) return reply.code(401).send({ error: 'invalid' });

        return reply.send({ ok: true, userId: row.id });
      });

      scoped.get<{ Params: { username: string } }>(
        '/internal/xmpp/users/:username',
        async (req, reply) => {
          const local = (req.params.username ?? '').toLowerCase();
          if (!local) return reply.code(404).send({ error: 'not_found' });
          const rows = await db
            .select({ id: users.id, username: users.username, deletedAt: users.deletedAt })
            .from(users)
            .where(eq(users.username, local))
            .limit(1);
          const row = rows[0];
          if (!row || row.deletedAt) return reply.code(404).send({ error: 'not_found' });
          return reply.send({ id: row.id, username: row.username });
        },
      );
    });
  },
});
