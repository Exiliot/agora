/**
 * Cheap per-request DB probes for the friends feature. Every helper accepts an
 * optional transaction handle so callers inside a `db.transaction` can share
 * the same visibility window.
 *
 * `pairKey` returns the ordered (a, b) tuple where a < b, matching the
 * `user_a_id < user_b_id` invariant on the `friendships` table.
 */

import { and, eq, or } from 'drizzle-orm';
import { type DB, db } from '../db/client.js';
import { friendships, userBans } from '../db/schema.js';

type Queryable = DB | Parameters<Parameters<DB['transaction']>[0]>[0];

export interface OrderedPair {
  a: string;
  b: string;
}

export const pairKey = (u1: string, u2: string): OrderedPair =>
  u1 < u2 ? { a: u1, b: u2 } : { a: u2, b: u1 };

export const areFriends = async (u1: string, u2: string, tx: Queryable = db): Promise<boolean> => {
  if (u1 === u2) return false;
  const { a, b } = pairKey(u1, u2);
  const rows = await tx
    .select({ userAId: friendships.userAId })
    .from(friendships)
    .where(and(eq(friendships.userAId, a), eq(friendships.userBId, b)))
    .limit(1);
  return rows.length > 0;
};

export const eitherSideBanned = async (
  u1: string,
  u2: string,
  tx: Queryable = db,
): Promise<boolean> => {
  const rows = await tx
    .select({ bannerId: userBans.bannerId })
    .from(userBans)
    .where(
      or(
        and(eq(userBans.bannerId, u1), eq(userBans.targetId, u2)),
        and(eq(userBans.bannerId, u2), eq(userBans.targetId, u1)),
      ),
    )
    .limit(1);
  return rows.length > 0;
};

/** Postgres unique-constraint violation. Mirrors rooms/invitations helper. */
const PG_UNIQUE_VIOLATION = '23505';

export const isUniqueViolation = (err: unknown): boolean =>
  typeof err === 'object' &&
  err !== null &&
  'code' in err &&
  (err as { code: string }).code === PG_UNIQUE_VIOLATION;
