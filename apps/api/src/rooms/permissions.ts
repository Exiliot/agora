/**
 * Per-request permission helpers for the rooms feature. Every check hits the DB
 * so stale state never grants access (see CLAUDE.md rule: access checks are
 * done at request time, every time).
 */

import { and, eq } from 'drizzle-orm';
import { type DB, db } from '../db/client.js';
import { roomBans, roomMembers, rooms } from '../db/schema.js';

type Queryable = DB | Parameters<Parameters<DB['transaction']>[0]>[0];

export interface RoomMembership {
  role: 'owner' | 'admin' | 'member';
}

export const getMembership = async (
  roomId: string,
  userId: string,
  tx: Queryable = db,
): Promise<RoomMembership | null> => {
  const rows = await tx
    .select({ role: roomMembers.role })
    .from(roomMembers)
    .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, userId)))
    .limit(1);
  const row = rows[0];
  return row ? { role: row.role } : null;
};

export const isMember = async (
  roomId: string,
  userId: string,
  tx: Queryable = db,
): Promise<boolean> => (await getMembership(roomId, userId, tx)) !== null;

export const isOwner = async (
  roomId: string,
  userId: string,
  tx: Queryable = db,
): Promise<boolean> => {
  const rows = await tx
    .select({ ownerId: rooms.ownerId })
    .from(rooms)
    .where(eq(rooms.id, roomId))
    .limit(1);
  return rows[0]?.ownerId === userId;
};

export const isAdminOrOwner = async (
  roomId: string,
  userId: string,
  tx: Queryable = db,
): Promise<boolean> => {
  const membership = await getMembership(roomId, userId, tx);
  return membership?.role === 'owner' || membership?.role === 'admin';
};

export const isBannedFromRoom = async (
  roomId: string,
  userId: string,
  tx: Queryable = db,
): Promise<boolean> => {
  const rows = await tx
    .select({ targetId: roomBans.targetId })
    .from(roomBans)
    .where(and(eq(roomBans.roomId, roomId), eq(roomBans.targetId, userId)))
    .limit(1);
  return rows.length > 0;
};
