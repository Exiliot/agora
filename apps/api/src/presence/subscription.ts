/**
 * Given a user whose presence state just changed, compute the set of other
 * users who should receive the `presence.update` event: their friends and the
 * members of any room they share.
 *
 * At MVP scale (hundreds of users, a few thousand friendships) this is cheap
 * enough to recompute on every broadcast. ADR-0002 warns against premature
 * caching; if this ever shows up in a profile we can add a short-lived memo.
 */

import { and, eq, inArray, ne, or } from 'drizzle-orm';
import { db } from '../db/client.js';
import { friendships, roomMembers } from '../db/schema.js';

export const listPresenceSubscribers = async (userId: string): Promise<string[]> => {
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
  return Array.from(subscribers);
};
