/**
 * Internal endpoints used by the XMPP sidecar. Delegated authentication is
 * handled here: Prosody hits us with credentials, we validate against the same
 * argon2id-hashed password store the web auth uses.
 *
 * Only mounted in Phase 2 topology — gated behind `ENABLE_XMPP_BRIDGE=1`.
 *
 * Prosody's community `mod_auth_http` uses GET requests with query params
 * against three paths:
 *   GET /…/check_password?user=&server=&pass=   -> 200 "true" / 200 "false"
 *   GET /…/user_exists?user=&server=             -> 200 "true" / 200 "false"
 *   GET /…/set_password                          -> unsupported (we own passwords)
 * We honour the two read shapes; we also keep the JSON/form POST shape for
 * callers (tests, future modules) that prefer it.
 */

import type { FastifyInstance } from 'fastify';
import formbody from '@fastify/formbody';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { addRouteModule } from '../routes/registry.js';
import { verifyPassword } from '../auth/password.js';
import { config } from '../config.js';

const postAuthBody = z
  .object({
    user: z.string().min(1).optional(),
    pass: z.string().min(1).optional(),
    username: z.string().min(1).optional(),
    password: z.string().min(1).optional(),
  })
  .refine((v) => (v.user ?? v.username) && (v.pass ?? v.password), {
    message: 'missing user/pass',
  });

const getAuthQuery = z.object({
  user: z.string().min(1),
  pass: z.string().min(1),
  server: z.string().min(1).optional(),
});

const getUserExistsQuery = z.object({
  user: z.string().min(1),
  server: z.string().min(1).optional(),
});

const lookupAndVerify = async (
  rawUser: string,
  rawPass: string,
): Promise<{ ok: boolean; userId?: string }> => {
  const local = rawUser.split('@')[0]?.toLowerCase() ?? '';
  if (!local) return { ok: false };
  const rows = await db
    .select({ id: users.id, passwordHash: users.passwordHash, deletedAt: users.deletedAt })
    .from(users)
    .where(sql`lower(${users.username}) = ${local}`)
    .limit(1);
  const row = rows[0];
  if (!row || row.deletedAt) return { ok: false };
  const ok = await verifyPassword(rawPass, row.passwordHash).catch(() => false);
  return ok ? { ok, userId: row.id } : { ok: false };
};

const userExists = async (rawUser: string): Promise<boolean> => {
  const local = rawUser.split('@')[0]?.toLowerCase() ?? '';
  if (!local) return false;
  const rows = await db
    .select({ id: users.id, deletedAt: users.deletedAt })
    .from(users)
    .where(sql`lower(${users.username}) = ${local}`)
    .limit(1);
  const row = rows[0];
  return Boolean(row && !row.deletedAt);
};

addRouteModule({
  name: 'xmpp',
  async register(app: FastifyInstance) {
    if (config.ENABLE_XMPP_BRIDGE !== '1') {
      app.log.info('xmpp bridge disabled (set ENABLE_XMPP_BRIDGE=1 to enable)');
      return;
    }

    await app.register(async (scoped) => {
      await scoped.register(formbody);

      // mod_auth_http GET — "true" / "false" plaintext body expected.
      scoped.get('/internal/xmpp/auth/check_password', async (req, reply) => {
        const parsed = getAuthQuery.safeParse(req.query);
        if (!parsed.success) return reply.type('text/plain').send('false');
        const { ok } = await lookupAndVerify(parsed.data.user, parsed.data.pass);
        return reply.type('text/plain').send(ok ? 'true' : 'false');
      });

      scoped.get('/internal/xmpp/auth/user_exists', async (req, reply) => {
        const parsed = getUserExistsQuery.safeParse(req.query);
        if (!parsed.success) return reply.type('text/plain').send('false');
        const exists = await userExists(parsed.data.user);
        return reply.type('text/plain').send(exists ? 'true' : 'false');
      });

      // JSON / form-POST shape — kept for tests and forward compatibility.
      scoped.post('/internal/xmpp/auth', async (req, reply) => {
        const parsed = postAuthBody.safeParse(req.body);
        if (!parsed.success) return reply.code(400).send({ error: 'validation' });
        const rawUser = parsed.data.user ?? parsed.data.username ?? '';
        const rawPass = parsed.data.pass ?? parsed.data.password ?? '';
        const result = await lookupAndVerify(rawUser, rawPass);
        if (!result.ok) return reply.code(401).send({ error: 'invalid' });
        return reply.send({ ok: true, userId: result.userId });
      });

      scoped.get<{ Params: { username: string } }>(
        '/internal/xmpp/users/:username',
        async (req, reply) => {
          const local = (req.params.username ?? '').toLowerCase();
          if (!local) return reply.code(404).send({ error: 'not_found' });
          const exists = await userExists(local);
          if (!exists) return reply.code(404).send({ error: 'not_found' });
          return reply.send({ username: local });
        },
      );
    });
  },
});
