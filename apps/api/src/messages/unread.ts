/**
 * Unread-counter maintenance. Called from inside the message-send transaction
 * (increment for each other participant) and from `mark.read` (reset to 0).
 *
 * The counters live in `conversation_unreads`. They're denormalised — the
 * derived "messages newer than last_read" is authoritative, but the cached
 * count gives the sidebar a cheap render path. Keep the two in step.
 */

import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { conversationUnreads, dmConversations, roomMembers } from '../db/schema.js';

type ConversationType = 'room' | 'dm';

/**
 * The helpers accept both the top-level `db` and a transaction handle from
 * `db.transaction(async (tx) => …)`. Drizzle's transaction type is tied to
 * the schema generics so we extract it from the actual `db.transaction`
 * callback rather than reconstruct it.
 */
type TxArg = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Db = typeof db | TxArg;

/**
 * Return the list of user ids that should see the new message for the given
 * conversation, excluding the author. For rooms that's every current member;
 * for DMs it's the single other participant.
 */
export const listOtherParticipants = async (
  tx: Db,
  conversationType: ConversationType,
  conversationId: string,
  excludeUserId: string,
): Promise<string[]> => {
  if (conversationType === 'room') {
    const rows = await (tx as typeof db)
      .select({ userId: roomMembers.userId })
      .from(roomMembers)
      .where(eq(roomMembers.roomId, conversationId));
    return rows.map((r) => r.userId).filter((id) => id !== excludeUserId);
  }
  const [row] = await (tx as typeof db)
    .select({ userAId: dmConversations.userAId, userBId: dmConversations.userBId })
    .from(dmConversations)
    .where(eq(dmConversations.id, conversationId))
    .limit(1);
  if (!row) return [];
  return [row.userAId === excludeUserId ? row.userBId : row.userAId];
};

export const incrementUnread = async (
  tx: Db,
  userId: string,
  conversationType: ConversationType,
  conversationId: string,
): Promise<number> => {
  const [row] = await (tx as typeof db)
    .insert(conversationUnreads)
    .values({ userId, conversationType, conversationId, count: 1 })
    .onConflictDoUpdate({
      target: [
        conversationUnreads.userId,
        conversationUnreads.conversationType,
        conversationUnreads.conversationId,
      ],
      set: { count: sql`${conversationUnreads.count} + 1` },
    })
    .returning({ count: conversationUnreads.count });
  return row?.count ?? 0;
};

export const resetUnread = async (
  userId: string,
  conversationType: ConversationType,
  conversationId: string,
): Promise<void> => {
  await db
    .insert(conversationUnreads)
    .values({ userId, conversationType, conversationId, count: 0 })
    .onConflictDoUpdate({
      target: [
        conversationUnreads.userId,
        conversationUnreads.conversationType,
        conversationUnreads.conversationId,
      ],
      set: { count: 0 },
    });
};

export const getUnread = async (
  userId: string,
  conversationType: ConversationType,
  conversationId: string,
): Promise<number> => {
  const [row] = await db
    .select({ count: conversationUnreads.count })
    .from(conversationUnreads)
    .where(
      and(
        eq(conversationUnreads.userId, userId),
        eq(conversationUnreads.conversationType, conversationType),
        eq(conversationUnreads.conversationId, conversationId),
      ),
    )
    .limit(1);
  return row?.count ?? 0;
};
