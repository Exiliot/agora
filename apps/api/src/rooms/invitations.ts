/**
 * Room invitation helpers — invitation lookup, accept, reject. The HTTP routes
 * call these inside their transactions to keep DB ops in one place.
 */

import { and, eq, sql } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import { type DB, db } from '../db/client.js';
import { roomInvitations, roomMembers, rooms, users } from '../db/schema.js';

type Tx = Parameters<Parameters<DB['transaction']>[0]>[0];

export interface InvitationRow {
  id: string;
  roomId: string;
  targetId: string;
  inviterId: string | null;
  createdAt: Date;
}

export interface InvitationWithContext extends InvitationRow {
  room: { id: string; name: string; description: string | null };
  inviter: { id: string; username: string } | null;
}

/** Unique-violation Postgres error code (duplicate key). */
const PG_UNIQUE_VIOLATION = '23505';

export const isUniqueViolation = (err: unknown): boolean =>
  typeof err === 'object' &&
  err !== null &&
  'code' in err &&
  (err as { code: string }).code === PG_UNIQUE_VIOLATION;

export const findUserByUsername = async (
  username: string,
  tx: DB | Tx = db,
): Promise<{ id: string; username: string } | null> => {
  const rows = await tx
    .select({ id: users.id, username: users.username, deletedAt: users.deletedAt })
    .from(users)
    .where(sql`lower(${users.username}) = lower(${username})`)
    .limit(1);
  const row = rows[0];
  if (!row || row.deletedAt) return null;
  return { id: row.id, username: row.username };
};

export const createInvitation = async (args: {
  roomId: string;
  targetId: string;
  inviterId: string;
}): Promise<InvitationRow> => {
  const id = uuidv7();
  const [row] = await db
    .insert(roomInvitations)
    .values({
      id,
      roomId: args.roomId,
      targetId: args.targetId,
      inviterId: args.inviterId,
    })
    .returning();
  if (!row) throw new Error('invitation insert returned no row');
  return row;
};

export const loadInvitation = async (
  id: string,
  tx: DB | Tx = db,
): Promise<InvitationWithContext | null> => {
  const rows = await tx
    .select({
      id: roomInvitations.id,
      roomId: roomInvitations.roomId,
      targetId: roomInvitations.targetId,
      inviterId: roomInvitations.inviterId,
      createdAt: roomInvitations.createdAt,
      roomName: rooms.name,
      roomDescription: rooms.description,
      inviterUsername: users.username,
    })
    .from(roomInvitations)
    .innerJoin(rooms, eq(rooms.id, roomInvitations.roomId))
    .leftJoin(users, eq(users.id, roomInvitations.inviterId))
    .where(eq(roomInvitations.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    roomId: row.roomId,
    targetId: row.targetId,
    inviterId: row.inviterId,
    createdAt: row.createdAt,
    room: { id: row.roomId, name: row.roomName, description: row.roomDescription },
    inviter:
      row.inviterId && row.inviterUsername
        ? { id: row.inviterId, username: row.inviterUsername }
        : null,
  };
};

export const deleteInvitation = async (id: string, tx: DB | Tx = db): Promise<void> => {
  await tx.delete(roomInvitations).where(eq(roomInvitations.id, id));
};

export const isAlreadyMember = async (
  roomId: string,
  userId: string,
  tx: DB | Tx = db,
): Promise<boolean> => {
  const rows = await tx
    .select({ userId: roomMembers.userId })
    .from(roomMembers)
    .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, userId)))
    .limit(1);
  return rows.length > 0;
};
