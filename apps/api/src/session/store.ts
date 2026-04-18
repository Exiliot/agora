/**
 * Session store: CRUD on the `sessions` table. Token strings are never stored
 * in plaintext — only their SHA-256 hashes. The plaintext token travels only
 * in the session cookie.
 */

import { createHash, randomBytes } from 'node:crypto';
import { and, eq, lt, ne } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import { db } from '../db/client.js';
import { sessions } from '../db/schema.js';

const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days sliding

export interface CreateSessionArgs {
  userId: string;
  userAgent: string | null;
  ip: string | null;
}

export interface SessionRecord {
  id: string;
  userId: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
}

export interface CreatedSession {
  record: SessionRecord;
  /** Plain token to set in the cookie. Not stored. */
  token: string;
}

const hashToken = (token: string): Buffer => createHash('sha256').update(token).digest();

const toRecord = (row: typeof sessions.$inferSelect): SessionRecord => ({
  id: row.id,
  userId: row.userId,
  userAgent: row.userAgent,
  ip: row.ip,
  createdAt: row.createdAt,
  lastSeenAt: row.lastSeenAt,
  expiresAt: row.expiresAt,
});

export const createSession = async (args: CreateSessionArgs): Promise<CreatedSession> => {
  const token = randomBytes(32).toString('base64url');
  const id = uuidv7();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

  const [inserted] = await db
    .insert(sessions)
    .values({
      id,
      userId: args.userId,
      tokenHash: hashToken(token),
      userAgent: args.userAgent,
      ip: args.ip,
      createdAt: now,
      lastSeenAt: now,
      expiresAt,
    })
    .returning();

  if (!inserted) throw new Error('failed to create session');
  return { record: toRecord(inserted), token };
};

export const findSessionByToken = async (token: string): Promise<SessionRecord | null> => {
  const rows = await db
    .select()
    .from(sessions)
    .where(eq(sessions.tokenHash, hashToken(token)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.expiresAt.getTime() <= Date.now()) return null;
  return toRecord(row);
};

export const touchSession = async (id: string): Promise<void> => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await db
    .update(sessions)
    .set({ lastSeenAt: now, expiresAt })
    .where(eq(sessions.id, id));
};

export const listSessionsForUser = async (userId: string): Promise<SessionRecord[]> => {
  const rows = await db
    .select()
    .from(sessions)
    .where(eq(sessions.userId, userId))
    .orderBy(sessions.lastSeenAt);
  return rows.map(toRecord);
};

export const deleteSession = async (id: string, userId: string): Promise<boolean> => {
  const rows = await db
    .delete(sessions)
    .where(and(eq(sessions.id, id), eq(sessions.userId, userId)))
    .returning({ id: sessions.id });
  return rows.length > 0;
};

export const deleteSessionsForUserExcept = async (
  userId: string,
  keepId: string | null,
): Promise<number> => {
  const where = keepId
    ? and(eq(sessions.userId, userId), ne(sessions.id, keepId))
    : eq(sessions.userId, userId);
  const rows = await db.delete(sessions).where(where).returning({ id: sessions.id });
  return rows.length;
};

export const deleteExpired = async (): Promise<number> => {
  const rows = await db
    .delete(sessions)
    .where(lt(sessions.expiresAt, new Date()))
    .returning({ id: sessions.id });
  return rows.length;
};
