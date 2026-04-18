/**
 * Password-reset token lifecycle. Tokens are 32-byte random strings, base64url
 * encoded; only their SHA-256 hash is persisted. TTL is 30 minutes per
 * requirements/01-auth.md. Single-use: `consumed_at` is stamped on consume.
 */

import { createHash, randomBytes } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import { db } from '../db/client.js';
import { passwordResets } from '../db/schema.js';

const RESET_TTL_MS = 30 * 60 * 1000;

export const hashResetToken = (token: string): Buffer =>
  createHash('sha256').update(token).digest();

export interface IssuedResetToken {
  token: string;
  expiresAt: Date;
}

export const issueResetToken = async (userId: string): Promise<IssuedResetToken> => {
  const token = randomBytes(32).toString('base64url');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + RESET_TTL_MS);

  await db.insert(passwordResets).values({
    id: uuidv7(),
    userId,
    tokenHash: hashResetToken(token),
    createdAt: now,
    expiresAt,
  });

  return { token, expiresAt };
};

export interface ConsumedResetToken {
  userId: string;
}

/**
 * Look up an unconsumed, unexpired token, mark it consumed, return the owning
 * user. Returns null if the token is unknown, already consumed, or expired.
 */
export const consumeResetToken = async (token: string): Promise<ConsumedResetToken | null> => {
  const tokenHash = hashResetToken(token);
  const rows = await db
    .select()
    .from(passwordResets)
    .where(and(eq(passwordResets.tokenHash, tokenHash), isNull(passwordResets.consumedAt)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (row.expiresAt.getTime() <= Date.now()) return null;

  const now = new Date();
  const updated = await db
    .update(passwordResets)
    .set({ consumedAt: now })
    .where(and(eq(passwordResets.id, row.id), isNull(passwordResets.consumedAt)))
    .returning({ id: passwordResets.id });

  if (updated.length === 0) return null;
  return { userId: row.userId };
};
