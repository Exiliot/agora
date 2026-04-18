/**
 * Permission checks for messaging. Each function hits the DB at request time
 * (AC-6 from CLAUDE.md: access checks are never cached across requests).
 *
 * The helpers return a discriminated object rather than throwing so callers
 * can map the outcome to a transport-appropriate error (HTTP status, WS err
 * code). See docs/ws-protocol.md §9 for the canonical error codes.
 */

import { and, eq, or } from 'drizzle-orm';
import { db } from '../db/client.js';
import {
  dmConversations,
  friendships,
  roomBans,
  roomMembers,
  userBans,
} from '../db/schema.js';

export type PermissionResult =
  | { ok: true; role?: 'owner' | 'admin' | 'member' }
  | { ok: false; code: 'not_found' | 'not_member' | 'banned' | 'not_friend' };

/**
 * Caller must be a current member of the room AND not in `room_bans` for that
 * room. A ban row and a membership row cannot coexist (ban removes membership)
 * but we check both defensively since they live in separate tables.
 */
export const canAccessRoom = async (
  userId: string,
  roomId: string,
): Promise<PermissionResult> => {
  const [ban] = await db
    .select({ targetId: roomBans.targetId })
    .from(roomBans)
    .where(and(eq(roomBans.roomId, roomId), eq(roomBans.targetId, userId)))
    .limit(1);
  if (ban) return { ok: false, code: 'banned' };

  const [membership] = await db
    .select({ role: roomMembers.role })
    .from(roomMembers)
    .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, userId)))
    .limit(1);
  if (!membership) return { ok: false, code: 'not_member' };

  return { ok: true, role: membership.role };
};

/**
 * Load a DM conversation and verify the caller is one of the two participants.
 * Does NOT check friendship/ban state; that's `canSendDm`.
 */
export const loadDmForUser = async (
  userId: string,
  dmId: string,
): Promise<
  | { ok: true; conversation: { id: string; userAId: string; userBId: string }; otherUserId: string }
  | { ok: false; code: 'not_found' | 'not_member' }
> => {
  const [row] = await db
    .select({
      id: dmConversations.id,
      userAId: dmConversations.userAId,
      userBId: dmConversations.userBId,
    })
    .from(dmConversations)
    .where(eq(dmConversations.id, dmId))
    .limit(1);
  if (!row) return { ok: false, code: 'not_found' };
  if (row.userAId !== userId && row.userBId !== userId) {
    return { ok: false, code: 'not_member' };
  }
  const otherUserId = row.userAId === userId ? row.userBId : row.userAId;
  return { ok: true, conversation: row, otherUserId };
};

/**
 * FR-MSG-10: a personal message is allowed only when a friendship exists AND
 * neither side has user-banned the other. `friendships` rows are always
 * (smaller UUID, larger UUID); `user_bans` is directional so we check both.
 */
export const canSendDm = async (
  userId: string,
  otherUserId: string,
): Promise<PermissionResult> => {
  if (userId === otherUserId) return { ok: false, code: 'not_friend' };

  const [a, b] = userId < otherUserId ? [userId, otherUserId] : [otherUserId, userId];

  const [ban] = await db
    .select({ bannerId: userBans.bannerId })
    .from(userBans)
    .where(
      or(
        and(eq(userBans.bannerId, userId), eq(userBans.targetId, otherUserId)),
        and(eq(userBans.bannerId, otherUserId), eq(userBans.targetId, userId)),
      ),
    )
    .limit(1);
  if (ban) return { ok: false, code: 'banned' };

  const [friendship] = await db
    .select({ userAId: friendships.userAId })
    .from(friendships)
    .where(and(eq(friendships.userAId, a), eq(friendships.userBId, b)))
    .limit(1);
  if (!friendship) return { ok: false, code: 'not_friend' };

  return { ok: true };
};

export const canAccessDm = async (
  userId: string,
  dmId: string,
): Promise<PermissionResult> => {
  const loaded = await loadDmForUser(userId, dmId);
  if (!loaded.ok) return { ok: false, code: loaded.code };
  const sendable = await canSendDm(userId, loaded.otherUserId);
  return sendable;
};
