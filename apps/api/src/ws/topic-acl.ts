/**
 * ACL check for client-initiated `subscribe` events. Without this, any
 * authenticated user could subscribe to any `room:<uuid>` / `dm:<uuid>` /
 * `user:<uuid>` topic and read every event fanned out on it — a critical
 * privacy breach (security audit finding 2026-04-18).
 *
 * The plumbing already auto-subscribes a user's connections to the right
 * topics on hello / join / DM-open; this module exists solely to lock down
 * the `subscribe` WS event so clients can't escalate.
 */

import { and, eq, or } from 'drizzle-orm';
import { db } from '../db/client.js';
import { dmConversations, roomBans, roomMembers } from '../db/schema.js';

const TOPIC_RE = /^(user|room|dm):([0-9a-f-]+)$/i;

export const canSubscribeToTopic = async (userId: string, topic: string): Promise<boolean> => {
  const match = TOPIC_RE.exec(topic);
  if (!match) return false;
  const kind = match[1]!.toLowerCase();
  const id = match[2]!;

  if (kind === 'user') {
    return id === userId;
  }

  if (kind === 'room') {
    const banned = await db
      .select({ v: roomBans.targetId })
      .from(roomBans)
      .where(and(eq(roomBans.roomId, id), eq(roomBans.targetId, userId)))
      .limit(1);
    if (banned.length > 0) return false;
    const membership = await db
      .select({ v: roomMembers.userId })
      .from(roomMembers)
      .where(and(eq(roomMembers.roomId, id), eq(roomMembers.userId, userId)))
      .limit(1);
    return membership.length > 0;
  }

  if (kind === 'dm') {
    const participant = await db
      .select({ id: dmConversations.id })
      .from(dmConversations)
      .where(
        and(
          eq(dmConversations.id, id),
          or(eq(dmConversations.userAId, userId), eq(dmConversations.userBId, userId)),
        ),
      )
      .limit(1);
    return participant.length > 0;
  }

  return false;
};
