/**
 * HTTP routes for the auth surface. Covers registration, sign-in/out, self
 * lookup, password reset (mocked email), password change, and account
 * deletion. See docs/requirements/01-auth.md for acceptance criteria.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { eq, sql } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import {
  passwordChangeRequest,
  passwordResetConsume,
  passwordResetRequest,
  registerRequest,
  signInRequest,
  type UserSelf,
} from '@agora/shared';
import { config } from '../config.js';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { addRouteModule } from '../routes/registry.js';
import { publishNotification } from '../notifications/publisher.js';
import { clearSessionCookie, setSessionCookie } from '../session/cookie.js';
import { requireAuth } from '../session/require-auth.js';
import {
  createSession,
  deleteSession,
  deleteSessionsForUserExcept,
} from '../session/store.js';
import { sendResetEmail } from './mailer.js';
import { hashPassword, verifyPassword } from './password.js';
import { consumeResetToken, issueResetToken } from './password-reset.js';
import { authRateLimit, registerRateLimitPlugin } from './rate-limit.js';

const toUserSelf = (row: {
  id: string;
  username: string;
  email: string;
  createdAt: Date;
}): UserSelf => ({
  id: row.id,
  username: row.username,
  email: row.email,
  createdAt: row.createdAt.toISOString(),
});

const userAgentOf = (req: FastifyRequest): string | null => {
  const raw = req.headers['user-agent'];
  if (typeof raw !== 'string' || raw.length === 0) return null;
  return raw.length > 1024 ? raw.slice(0, 1024) : raw;
};

const ipOf = (req: FastifyRequest): string | null => req.ip ?? null;

const RESET_LINK_BASE = `${config.APP_BASE_URL.replace(/\/$/, '')}/reset`;

const issueSessionCookie = async (
  req: FastifyRequest,
  reply: FastifyReply,
  userId: string,
): Promise<void> => {
  const created = await createSession({
    userId,
    userAgent: userAgentOf(req),
    ip: ipOf(req),
  });
  setSessionCookie(reply, created.token);
};

addRouteModule({
  name: 'auth',
  async register(app: FastifyInstance) {
    await registerRateLimitPlugin(app);
    app.post('/api/auth/register', authRateLimit, async (req, reply) => {
      const parsed = registerRequest.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid_input', issues: parsed.error.issues });
      }
      const { email, username, password } = parsed.data;

      const existingEmail = await db
        .select({ id: users.id })
        .from(users)
        .where(sql`lower(${users.email}) = lower(${email})`)
        .limit(1);
      if (existingEmail.length > 0) {
        return reply.code(409).send({ error: 'email_taken', message: 'email already registered' });
      }

      const existingUsername = await db
        .select({ id: users.id })
        .from(users)
        .where(sql`lower(${users.username}) = lower(${username})`)
        .limit(1);
      if (existingUsername.length > 0) {
        return reply
          .code(409)
          .send({ error: 'username_taken', message: 'username already registered' });
      }

      const passwordHash = await hashPassword(password);
      const id = uuidv7();
      const [inserted] = await db
        .insert(users)
        .values({ id, email, username, passwordHash })
        .returning({
          id: users.id,
          email: users.email,
          username: users.username,
          createdAt: users.createdAt,
        });
      if (!inserted) throw new Error('failed to create user');

      await issueSessionCookie(req, reply, inserted.id);
      return reply.code(201).send({ user: toUserSelf(inserted) });
    });

    app.post('/api/auth/sign-in', authRateLimit, async (req, reply) => {
      const parsed = signInRequest.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid_input', issues: parsed.error.issues });
      }
      const { email, password } = parsed.data;

      const rows = await db
        .select({
          id: users.id,
          email: users.email,
          username: users.username,
          passwordHash: users.passwordHash,
          createdAt: users.createdAt,
          deletedAt: users.deletedAt,
        })
        .from(users)
        .where(sql`lower(${users.email}) = lower(${email})`)
        .limit(1);
      const row = rows[0];

      const invalid = { error: 'invalid_credentials', message: 'invalid email or password' };
      if (!row || row.deletedAt) {
        return reply.code(401).send(invalid);
      }
      const ok = await verifyPassword(password, row.passwordHash);
      if (!ok) {
        return reply.code(401).send(invalid);
      }

      await issueSessionCookie(req, reply, row.id);
      return reply.code(200).send({ user: toUserSelf(row) });
    });

    app.post('/api/auth/sign-out', { onRequest: requireAuth }, async (req, reply) => {
      const session = req.session;
      const user = req.user;
      if (!session || !user) return reply.code(401).send({ error: 'unauthenticated' });

      await deleteSession(session.id, user.id);
      clearSessionCookie(reply);
      return reply.code(204).send();
    });

    app.get('/api/auth/me', { onRequest: requireAuth }, async (req, reply) => {
      const user = req.user;
      if (!user) return reply.code(401).send({ error: 'unauthenticated' });

      const rows = await db
        .select({
          id: users.id,
          email: users.email,
          username: users.username,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1);
      const row = rows[0];
      if (!row) return reply.code(401).send({ error: 'unauthenticated' });
      return reply.code(200).send({ user: toUserSelf(row) });
    });

    app.post('/api/auth/password-reset/request', authRateLimit, async (req, reply) => {
      const parsed = passwordResetRequest.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid_input', issues: parsed.error.issues });
      }
      const { email } = parsed.data;

      const rows = await db
        .select({ id: users.id, deletedAt: users.deletedAt })
        .from(users)
        .where(sql`lower(${users.email}) = lower(${email})`)
        .limit(1);
      const row = rows[0];

      if (row && !row.deletedAt) {
        const issued = await issueResetToken(row.id);
        const link = `${RESET_LINK_BASE}?token=${issued.token}`;
        // Reset tokens grant account takeover; in a real deployment with a
        // mailer wired up this should NOT be logged. Agora ships as a demo
        // with no email service, so the operator's only way to find the link
        // is the server log. Gated on AGORA_DEMO_MODE so any deployment that
        // wires a real mailer keeps the link out of stdout. See ADR-0010.
        if (config.AGORA_DEMO_MODE === '1') {
          req.log.info({ auth: 'reset_link_issued' }, link);
          // eslint-disable-next-line no-console
          console.error('[AUTH reset link]', link);
        } else {
          await sendResetEmail({ to: email, link });
        }
      }

      return reply.code(204).send();
    });

    app.post('/api/auth/password-reset/consume', authRateLimit, async (req, reply) => {
      const parsed = passwordResetConsume.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid_input', issues: parsed.error.issues });
      }
      const { token, password } = parsed.data;

      const consumed = await consumeResetToken(token);
      if (!consumed) {
        return reply
          .code(400)
          .send({ error: 'invalid_token', message: 'reset token is invalid or expired' });
      }

      const passwordHash = await hashPassword(password);
      await db
        .update(users)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(users.id, consumed.userId));

      const revokedCount = await deleteSessionsForUserExcept(consumed.userId, null);
      if (revokedCount > 0) {
        await publishNotification({
          userId: consumed.userId,
          kind: 'session.revoked_elsewhere',
          subjectType: null,
          subjectId: null,
          actorId: null,
          payload: { revokedCount, reason: 'password_reset' },
        });
      }
      return reply.code(204).send();
    });

    app.post('/api/auth/password-change', { onRequest: requireAuth, ...authRateLimit }, async (req, reply) => {
      const parsed = passwordChangeRequest.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid_input', issues: parsed.error.issues });
      }
      const user = req.user;
      const session = req.session;
      if (!user || !session) return reply.code(401).send({ error: 'unauthenticated' });

      const { currentPassword, newPassword } = parsed.data;

      const rows = await db
        .select({ passwordHash: users.passwordHash })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1);
      const row = rows[0];
      if (!row) return reply.code(401).send({ error: 'unauthenticated' });

      const ok = await verifyPassword(currentPassword, row.passwordHash);
      if (!ok) {
        return reply
          .code(401)
          .send({ error: 'invalid_credentials', message: 'current password is incorrect' });
      }

      const passwordHash = await hashPassword(newPassword);
      await db
        .update(users)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(users.id, user.id));

      const revokedCount = await deleteSessionsForUserExcept(user.id, session.id);
      if (revokedCount > 0) {
        await publishNotification({
          userId: user.id,
          kind: 'session.revoked_elsewhere',
          subjectType: null,
          subjectId: null,
          actorId: null,
          payload: { revokedCount, reason: 'password_change' },
        });
      }
      return reply.code(204).send();
    });

    app.delete('/api/users/me', { onRequest: requireAuth }, async (req, reply) => {
      const user = req.user;
      if (!user) return reply.code(401).send({ error: 'unauthenticated' });

      // All dependent rows (sessions, owned rooms with their memberships/messages/attachments,
      // memberships elsewhere, friendships, friend_requests, bans) cascade from the users
      // FK. Messages and attachments authored/uploaded by this user switch to NULL via
      // ON DELETE SET NULL, preserving history per FR-AUTH-13. We wrap the delete in an
      // explicit transaction for clarity even though Postgres would perform cascades
      // atomically anyway.
      await db.transaction(async (tx) => {
        await tx.delete(users).where(eq(users.id, user.id));
      });

      clearSessionCookie(reply);
      return reply.code(204).send();
    });
  },
});
