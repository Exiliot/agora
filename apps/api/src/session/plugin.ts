/**
 * Session middleware. Reads the session cookie, resolves it against the DB,
 * and attaches `request.session` + `request.user`. Unauthenticated requests
 * are allowed to pass through — the `requireAuth` hook enforces auth when a
 * route needs it.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import { findSessionByToken, touchSession, type SessionRecord } from './store.js';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export const COOKIE_NAME = 'agora_session';

export interface AuthedUser {
  id: string;
  username: string;
  email: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    session: SessionRecord | null;
    user: AuthedUser | null;
  }
}

const loadUser = async (userId: string): Promise<AuthedUser | null> => {
  const rows = await db
    .select({ id: users.id, username: users.username, email: users.email, deletedAt: users.deletedAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const row = rows[0];
  if (!row || row.deletedAt) return null;
  return { id: row.id, username: row.username, email: row.email };
};

const plugin = async (app: FastifyInstance): Promise<void> => {
  app.addHook('onRequest', async (req: FastifyRequest, _reply: FastifyReply) => {
    req.session = null;
    req.user = null;

    const token = req.cookies[COOKIE_NAME];
    if (!token) return;

    const record = await findSessionByToken(token);
    if (!record) return;

    const user = await loadUser(record.userId);
    if (!user) return;

    req.session = record;
    req.user = user;

    // Slide the expiry window on every authenticated request, but cheaply —
    // fire-and-forget, don't block the request.
    void touchSession(record.id).catch(() => undefined);
  });
};

export const sessionPlugin = fastifyPlugin(plugin, { name: 'agora-session' });
