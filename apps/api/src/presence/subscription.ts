/**
 * Given a user whose presence state just changed, compute the set of other
 * users who should receive the `presence.update` event: their friends and the
 * members of any room they share.
 *
 * Cached for a short TTL so the 2-second sweeper doesn't hit the DB twice
 * per transitioning user every tick. The cache is invalidated by the
 * friendship and room-membership mutation paths (see
 * `invalidatePresenceSubscribers`).
 */

import { and, eq, inArray, ne, or } from 'drizzle-orm';
import { db } from '../db/client.js';
import { friendships, roomMembers } from '../db/schema.js';

const TTL_MS = 10_000;

interface Entry {
  at: number;
  users: string[];
}

const cache = new Map<string, Entry>();

export const listPresenceSubscribers = async (userId: string): Promise<string[]> => {
  const cached = cache.get(userId);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.users;

  const friendRows = await db
    .select({ a: friendships.userAId, b: friendships.userBId })
    .from(friendships)
    .where(or(eq(friendships.userAId, userId), eq(friendships.userBId, userId)));

  const subscribers = new Set<string>();
  for (const row of friendRows) {
    subscribers.add(row.a === userId ? row.b : row.a);
  }

  const myRoomIds = await db
    .select({ roomId: roomMembers.roomId })
    .from(roomMembers)
    .where(eq(roomMembers.userId, userId));

  if (myRoomIds.length > 0) {
    const roomIds = myRoomIds.map((r) => r.roomId);
    const coMembers = await db
      .select({ userId: roomMembers.userId })
      .from(roomMembers)
      .where(and(inArray(roomMembers.roomId, roomIds), ne(roomMembers.userId, userId)));
    for (const row of coMembers) subscribers.add(row.userId);
  }

  subscribers.delete(userId);
  const users = Array.from(subscribers);
  cache.set(userId, { at: Date.now(), users });
  return users;
};

/**
 * Drop cached subscriber sets for the given users. Call after any mutation
 * that changes who can see whose presence: friend accept/remove, user-ban
 * create/remove, room join/leave/remove, room delete.
 */
export const invalidatePresenceSubscribers = (...userIds: string[]): void => {
  for (const userId of userIds) cache.delete(userId);
};

export const __resetPresenceSubscriberCacheForTests = (): void => {
  cache.clear();
};
