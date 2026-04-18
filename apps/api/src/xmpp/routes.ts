/**
 * Internal endpoints used by the XMPP sidecar. Delegated authentication is
 * handled here: Prosody POSTs credentials, we validate against the same
 * argon2id-hashed password store the web auth uses.
 *
 * Only mounted in Phase 2 topology — gated behind `ENABLE_XMPP_BRIDGE=1`.
 */

import type { FastifyInstance } from 'fastify';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { addRouteModule } from '../routes/registry.js';
import { verifyPassword } from '../auth/password.js';
import { config } from '../config.js';

const authBody = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

addRouteModule({
  name: 'xmpp',
  register(app: FastifyInstance) {
    if (config.ENABLE_XMPP_BRIDGE !== '1') {
      app.log.info('xmpp bridge disabled (set ENABLE_XMPP_BRIDGE=1 to enable)');
      return;
    }

    // Prosody posts { username, password }; we respond 200 for valid, 401 for
    // invalid. Username may arrive with the JID localpart only or as
    // "local@domain" — we accept both and key off the localpart.
    app.post('/internal/xmpp/auth', async (req, reply) => {
      const parsed = authBody.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'validation' });

      const local = parsed.data.username.split('@')[0]?.toLowerCase() ?? '';
      if (!local) return reply.code(401).send({ error: 'invalid' });

      const rows = await db
        .select({ id: users.id, passwordHash: users.passwordHash, deletedAt: users.deletedAt })
        .from(users)
        .where(sql`lower(${users.username}) = ${local}`)
        .limit(1);
      const row = rows[0];
      if (!row || row.deletedAt) return reply.code(401).send({ error: 'invalid' });

      const ok = await verifyPassword(parsed.data.password, row.passwordHash).catch(() => false);
      if (!ok) return reply.code(401).send({ error: 'invalid' });

      return reply.send({ ok: true, userId: row.id });
    });

    // Thin user-existence lookup — Prosody can use this as a "is-user" check
    // during s2s presence subscriptions in federation.
    app.get<{ Params: { username: string } }>(
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
  },
});
