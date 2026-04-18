/**
 * Rooms HTTP surface: create, discover, join, leave, moderate, invite.
 *
 * Every route in this module requires authentication. Access is checked on
 * every request — membership + ban state is never cached across requests.
 */

import {
  type RoomDetail,
  type RoomMember,
  type RoomSummary,
  createRoomRequest,
  inviteToRoomRequest,
} from '@agora/shared/rooms';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { FastifyInstance } from 'fastify';
import { uuidv7 } from 'uuidv7';
import { db } from '../db/client.js';
import { roomBans, roomInvitations, roomMembers, rooms, users } from '../db/schema.js';
import { addRouteModule } from '../routes/registry.js';
import { isAuthed, requireAuth } from '../session/require-auth.js';
import {
  publishInvitationReceived,
  publishRoomAccessLost,
  publishRoomAdminAdded,
  publishRoomAdminRemoved,
  publishRoomDeleted,
  publishRoomMemberJoined,
  publishRoomMemberLeft,
  publishRoomMemberRemoved,
} from './events.js';
import {
  createInvitation,
  deleteInvitation,
  findUserByUsername,
  isAlreadyMember,
  isUniqueViolation,
  loadInvitation,
} from './invitations.js';
import { getMembership, isAdminOrOwner, isBannedFromRoom, isOwner } from './permissions.js';

interface RoomRow {
  id: string;
  name: string;
  description: string | null;
  visibility: 'public' | 'private';
  ownerId: string;
  createdAt: Date;
}

const loadRoom = async (id: string): Promise<RoomRow | null> => {
  const rows = await db
    .select({
      id: rooms.id,
      name: rooms.name,
      description: rooms.description,
      visibility: rooms.visibility,
      ownerId: rooms.ownerId,
      createdAt: rooms.createdAt,
    })
    .from(rooms)
    .where(eq(rooms.id, id))
    .limit(1);
  return rows[0] ?? null;
};

const loadRoomDetail = async (
  roomRow: RoomRow,
  callerUserId: string,
): Promise<RoomDetail & { myRole: 'owner' | 'admin' | 'member' | null }> => {
  const memberRows = await db
    .select({
      userId: roomMembers.userId,
      role: roomMembers.role,
      joinedAt: roomMembers.joinedAt,
      username: users.username,
    })
    .from(roomMembers)
    .innerJoin(users, eq(users.id, roomMembers.userId))
    .where(eq(roomMembers.roomId, roomRow.id));

  const members: RoomMember[] = memberRows.map((m) => ({
    user: { id: m.userId, username: m.username },
    role: m.role,
    joinedAt: m.joinedAt.toISOString(),
  }));

  const owner = memberRows.find((m) => m.role === 'owner');
  const admins = memberRows
    .filter((m) => m.role === 'admin')
    .map((m) => ({ id: m.userId, username: m.username }));

  const mine = memberRows.find((m) => m.userId === callerUserId);

  return {
    id: roomRow.id,
    name: roomRow.name,
    description: roomRow.description,
    visibility: roomRow.visibility,
    memberCount: members.length,
    owner: owner
      ? { id: owner.userId, username: owner.username }
      : { id: roomRow.ownerId, username: '' },
    admins,
    members,
    createdAt: roomRow.createdAt.toISOString(),
    myRole: mine?.role ?? null,
  };
};

addRouteModule({
  name: 'rooms',
  register(app: FastifyInstance): void {
    app.register(async (scoped) => {
      scoped.addHook('onRequest', requireAuth);

      // --- create room ----------------------------------------------------
      scoped.post('/api/rooms', async (req, reply) => {
        if (!isAuthed(req)) return;
        const parsed = createRoomRequest.safeParse(req.body);
        if (!parsed.success) {
          return reply.code(400).send({
            error: 'validation',
            message: parsed.error.issues[0]?.message ?? 'invalid body',
          });
        }

        const userId = req.user.id;
        const id = uuidv7();
        const now = new Date();

        try {
          const inserted = await db.transaction(async (tx) => {
            const [room] = await tx
              .insert(rooms)
              .values({
                id,
                name: parsed.data.name,
                description: parsed.data.description ?? null,
                visibility: parsed.data.visibility,
                ownerId: userId,
                createdAt: now,
                updatedAt: now,
              })
              .returning();
            if (!room) throw new Error('room insert returned no row');

            await tx.insert(roomMembers).values({
              roomId: room.id,
              userId,
              role: 'owner',
              joinedAt: now,
            });

            return room;
          });

          const detail = await loadRoomDetail(
            {
              id: inserted.id,
              name: inserted.name,
              description: inserted.description,
              visibility: inserted.visibility,
              ownerId: inserted.ownerId,
              createdAt: inserted.createdAt,
            },
            userId,
          );
          return reply.code(201).send(detail);
        } catch (err) {
          if (isUniqueViolation(err)) {
            return reply.code(409).send({
              error: 'conflict',
              code: 'room_name_taken',
              message: 'room name already taken',
            });
          }
          throw err;
        }
      });

      // --- public catalogue + my rooms ------------------------------------
      scoped.get('/api/rooms', async (req, reply) => {
        if (!isAuthed(req)) return;
        const query = req.query as { visibility?: string; q?: string; limit?: string };
        if (query.visibility !== 'public') {
          return reply
            .code(400)
            .send({ error: 'validation', message: 'visibility=public is required' });
        }
        const q = typeof query.q === 'string' ? query.q.trim() : '';
        const parsedLimit = Number.parseInt(query.limit ?? '', 10);
        const limit =
          Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 50) : 50;

        const whereClauses = [eq(rooms.visibility, 'public')];
        if (q.length > 0) {
          const like = `%${q}%`;
          const textMatch = or(ilike(rooms.name, like), ilike(rooms.description, like));
          if (textMatch) whereClauses.push(textMatch);
        }

        const rawRows = await db
          .select({
            id: rooms.id,
            name: rooms.name,
            description: rooms.description,
            visibility: rooms.visibility,
            memberCount: sql<number>`(SELECT COUNT(*)::int FROM ${roomMembers} WHERE ${roomMembers.roomId} = ${rooms.id})`,
          })
          .from(rooms)
          .where(and(...whereClauses))
          .orderBy(
            desc(
              sql`(SELECT COUNT(*) FROM ${roomMembers} WHERE ${roomMembers.roomId} = ${rooms.id})`,
            ),
          )
          .limit(limit);

        const summaries: RoomSummary[] = rawRows.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          visibility: r.visibility,
          memberCount: r.memberCount,
        }));
        return reply.send({ rooms: summaries });
      });

      // --- my rooms -------------------------------------------------------
      scoped.get('/api/rooms/mine', async (req, reply) => {
        if (!isAuthed(req)) return;
        const userId = req.user.id;
        const rawRows = await db
          .select({
            id: rooms.id,
            name: rooms.name,
            description: rooms.description,
            visibility: rooms.visibility,
            role: roomMembers.role,
            memberCount: sql<number>`(SELECT COUNT(*)::int FROM ${roomMembers} rm2 WHERE rm2.room_id = ${rooms.id})`,
          })
          .from(roomMembers)
          .innerJoin(rooms, eq(rooms.id, roomMembers.roomId))
          .where(eq(roomMembers.userId, userId))
          .orderBy(rooms.name);

        const summaries = rawRows.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          visibility: r.visibility,
          memberCount: r.memberCount,
          myRole: r.role,
        }));
        return reply.send({ rooms: summaries });
      });

      // --- room detail ----------------------------------------------------
      scoped.get<{ Params: { id: string } }>('/api/rooms/:id', async (req, reply) => {
        if (!isAuthed(req)) return;
        const { id } = req.params;
        const room = await loadRoom(id);
        if (!room) return reply.code(404).send({ error: 'not_found' });

        if (await isBannedFromRoom(id, req.user.id)) {
          return reply.code(403).send({ error: 'forbidden', code: 'banned' });
        }

        const detail = await loadRoomDetail(room, req.user.id);
        if (room.visibility === 'private' && detail.myRole === null) {
          return reply.code(403).send({ error: 'forbidden', code: 'not_member' });
        }
        return reply.send(detail);
      });

      // --- join public room ----------------------------------------------
      scoped.post<{ Params: { id: string } }>('/api/rooms/:id/join', async (req, reply) => {
        if (!isAuthed(req)) return;
        const { id } = req.params;
        const userId = req.user.id;
        const username = req.user.username;

        const room = await loadRoom(id);
        if (!room) return reply.code(404).send({ error: 'not_found' });
        if (room.visibility !== 'public') {
          return reply.code(403).send({ error: 'forbidden', code: 'private_room' });
        }
        if (await isBannedFromRoom(id, userId)) {
          return reply.code(403).send({ error: 'forbidden', code: 'banned' });
        }

        const existing = await getMembership(id, userId);
        if (existing) {
          const detail = await loadRoomDetail(room, userId);
          return reply.code(200).send(detail);
        }

        await db.insert(roomMembers).values({
          roomId: id,
          userId,
          role: 'member',
          joinedAt: new Date(),
        });

        publishRoomMemberJoined(id, { id: userId, username });

        const detail = await loadRoomDetail(room, userId);
        return reply.code(201).send(detail);
      });

      // --- leave room -----------------------------------------------------
      scoped.post<{ Params: { id: string } }>('/api/rooms/:id/leave', async (req, reply) => {
        if (!isAuthed(req)) return;
        const { id } = req.params;
        const userId = req.user.id;

        const membership = await getMembership(id, userId);
        if (!membership) return reply.code(404).send({ error: 'not_found', code: 'not_member' });

        if (membership.role === 'owner') {
          return reply.code(409).send({
            error: 'conflict',
            code: 'owner_cannot_leave',
            message: 'owner must delete the room instead of leaving',
          });
        }

        await db
          .delete(roomMembers)
          .where(and(eq(roomMembers.roomId, id), eq(roomMembers.userId, userId)));

        publishRoomMemberLeft(id, userId);
        return reply.code(204).send();
      });

      // --- delete room ----------------------------------------------------
      scoped.delete<{ Params: { id: string } }>('/api/rooms/:id', async (req, reply) => {
        if (!isAuthed(req)) return;
        const { id } = req.params;
        const userId = req.user.id;

        const room = await loadRoom(id);
        if (!room) return reply.code(404).send({ error: 'not_found' });
        if (room.ownerId !== userId) {
          return reply.code(403).send({ error: 'forbidden', code: 'owner_only' });
        }

        const priorMembers = await db
          .select({ userId: roomMembers.userId })
          .from(roomMembers)
          .where(eq(roomMembers.roomId, id));

        await db.transaction(async (tx) => {
          await tx.delete(rooms).where(eq(rooms.id, id));
        });

        publishRoomDeleted(id);
        for (const m of priorMembers) {
          publishRoomAccessLost(m.userId, id, 'room_deleted');
        }
        return reply.code(204).send();
      });

      // --- invite to room ------------------------------------------------
      scoped.post<{ Params: { id: string } }>('/api/rooms/:id/invitations', async (req, reply) => {
        if (!isAuthed(req)) return;
        const { id } = req.params;
        const userId = req.user.id;

        const parsed = inviteToRoomRequest.safeParse(req.body);
        if (!parsed.success) {
          return reply.code(400).send({
            error: 'validation',
            message: parsed.error.issues[0]?.message ?? 'invalid body',
          });
        }

        const room = await loadRoom(id);
        if (!room) return reply.code(404).send({ error: 'not_found' });
        if (room.visibility !== 'private') {
          return reply.code(400).send({ error: 'validation', code: 'not_private' });
        }
        if (!(await getMembership(id, userId))) {
          return reply.code(403).send({ error: 'forbidden', code: 'not_member' });
        }

        const target = await findUserByUsername(parsed.data.targetUsername);
        if (!target) return reply.code(404).send({ error: 'not_found', code: 'user_not_found' });
        if (target.id === userId) {
          return reply.code(400).send({ error: 'validation', code: 'self_invite' });
        }
        if (await isAlreadyMember(id, target.id)) {
          return reply.code(409).send({ error: 'conflict', code: 'already_member' });
        }
        if (await isBannedFromRoom(id, target.id)) {
          return reply.code(409).send({ error: 'conflict', code: 'target_banned' });
        }

        try {
          const invitation = await createInvitation({
            roomId: id,
            targetId: target.id,
            inviterId: userId,
          });

          publishInvitationReceived(target.id, {
            id: invitation.id,
            room: { id: room.id, name: room.name, description: room.description },
            inviter: { id: userId, username: req.user.username },
            createdAt: invitation.createdAt.toISOString(),
          });

          return reply.code(201).send({
            id: invitation.id,
            roomId: invitation.roomId,
            targetId: invitation.targetId,
            createdAt: invitation.createdAt.toISOString(),
          });
        } catch (err) {
          if (isUniqueViolation(err)) {
            return reply.code(409).send({ error: 'conflict', code: 'already_invited' });
          }
          throw err;
        }
      });

      // --- accept invitation ---------------------------------------------
      scoped.post<{ Params: { id: string } }>('/api/invitations/:id/accept', async (req, reply) => {
        if (!isAuthed(req)) return;
        const { id } = req.params;
        const userId = req.user.id;
        const username = req.user.username;

        const invitation = await loadInvitation(id);
        if (!invitation) return reply.code(404).send({ error: 'not_found' });
        if (invitation.targetId !== userId) {
          return reply.code(403).send({ error: 'forbidden', code: 'not_invitee' });
        }

        if (await isBannedFromRoom(invitation.roomId, userId)) {
          await deleteInvitation(id);
          return reply.code(403).send({ error: 'forbidden', code: 'banned' });
        }

        await db.transaction(async (tx) => {
          const existing = await tx
            .select({ userId: roomMembers.userId })
            .from(roomMembers)
            .where(and(eq(roomMembers.roomId, invitation.roomId), eq(roomMembers.userId, userId)))
            .limit(1);

          if (existing.length === 0) {
            await tx.insert(roomMembers).values({
              roomId: invitation.roomId,
              userId,
              role: 'member',
              joinedAt: new Date(),
            });
          }

          await tx.delete(roomInvitations).where(eq(roomInvitations.id, id));
        });

        publishRoomMemberJoined(invitation.roomId, { id: userId, username });
        return reply.code(200).send({ roomId: invitation.roomId });
      });

      // --- reject invitation ---------------------------------------------
      scoped.post<{ Params: { id: string } }>('/api/invitations/:id/reject', async (req, reply) => {
        if (!isAuthed(req)) return;
        const { id } = req.params;
        const userId = req.user.id;

        const invitation = await loadInvitation(id);
        if (!invitation) return reply.code(404).send({ error: 'not_found' });
        if (invitation.targetId !== userId) {
          return reply.code(403).send({ error: 'forbidden', code: 'not_invitee' });
        }

        await deleteInvitation(id);
        return reply.code(204).send();
      });

      // --- promote admin -------------------------------------------------
      scoped.post<{ Params: { id: string } }>('/api/rooms/:id/admins', async (req, reply) => {
        if (!isAuthed(req)) return;
        const { id } = req.params;
        const userId = req.user.id;
        const body = req.body as { userId?: unknown };
        if (typeof body?.userId !== 'string') {
          return reply.code(400).send({ error: 'validation', message: 'userId is required' });
        }
        const targetId = body.userId;

        const room = await loadRoom(id);
        if (!room) return reply.code(404).send({ error: 'not_found' });
        if (room.ownerId !== userId) {
          return reply.code(403).send({ error: 'forbidden', code: 'owner_only' });
        }

        const membership = await getMembership(id, targetId);
        if (!membership) {
          return reply.code(400).send({ error: 'validation', code: 'not_member' });
        }
        if (membership.role === 'owner') {
          return reply.code(400).send({ error: 'validation', code: 'is_owner' });
        }
        if (membership.role === 'admin') {
          return reply.code(200).send({ roomId: id, userId: targetId });
        }

        await db
          .update(roomMembers)
          .set({ role: 'admin' })
          .where(and(eq(roomMembers.roomId, id), eq(roomMembers.userId, targetId)));

        publishRoomAdminAdded(id, targetId);
        return reply.code(201).send({ roomId: id, userId: targetId });
      });

      // --- demote admin --------------------------------------------------
      scoped.delete<{ Params: { id: string; userId: string } }>(
        '/api/rooms/:id/admins/:userId',
        async (req, reply) => {
          if (!isAuthed(req)) return;
          const { id, userId: targetId } = req.params;
          const callerId = req.user.id;

          const room = await loadRoom(id);
          if (!room) return reply.code(404).send({ error: 'not_found' });
          if (room.ownerId === targetId) {
            return reply.code(400).send({ error: 'validation', code: 'cannot_demote_owner' });
          }

          const callerRole = (await getMembership(id, callerId))?.role;
          const targetRole = (await getMembership(id, targetId))?.role;

          if (callerRole !== 'owner' && callerRole !== 'admin') {
            return reply.code(403).send({ error: 'forbidden', code: 'not_admin' });
          }
          if (!targetRole) {
            return reply.code(404).send({ error: 'not_found', code: 'not_member' });
          }
          if (targetRole !== 'admin') {
            return reply.code(400).send({ error: 'validation', code: 'not_admin' });
          }

          await db
            .update(roomMembers)
            .set({ role: 'member' })
            .where(and(eq(roomMembers.roomId, id), eq(roomMembers.userId, targetId)));

          publishRoomAdminRemoved(id, targetId);
          return reply.code(204).send();
        },
      );

      // --- remove member (= ban) -----------------------------------------
      scoped.delete<{ Params: { id: string; userId: string } }>(
        '/api/rooms/:id/members/:userId',
        async (req, reply) => {
          if (!isAuthed(req)) return;
          const { id, userId: targetId } = req.params;
          const callerId = req.user.id;

          const room = await loadRoom(id);
          if (!room) return reply.code(404).send({ error: 'not_found' });
          if (!(await isAdminOrOwner(id, callerId))) {
            return reply.code(403).send({ error: 'forbidden', code: 'not_admin' });
          }
          if (targetId === callerId) {
            return reply.code(400).send({ error: 'validation', code: 'cannot_remove_self' });
          }
          if (room.ownerId === targetId) {
            return reply.code(400).send({ error: 'validation', code: 'cannot_remove_owner' });
          }

          const targetMembership = await getMembership(id, targetId);
          if (!targetMembership) {
            return reply.code(404).send({ error: 'not_found', code: 'not_member' });
          }
          if (targetMembership.role === 'admin' && (await isOwner(id, callerId)) === false) {
            return reply.code(403).send({ error: 'forbidden', code: 'admin_cannot_remove_admin' });
          }

          const body = (req.body ?? {}) as { reason?: unknown };
          const reason = typeof body.reason === 'string' ? body.reason : null;

          await db.transaction(async (tx) => {
            await tx
              .insert(roomBans)
              .values({
                roomId: id,
                targetId,
                bannerId: callerId,
                reason,
              })
              .onConflictDoNothing({ target: [roomBans.roomId, roomBans.targetId] });

            await tx
              .delete(roomMembers)
              .where(and(eq(roomMembers.roomId, id), eq(roomMembers.userId, targetId)));
          });

          publishRoomMemberRemoved(id, targetId, callerId);
          publishRoomAccessLost(targetId, id, 'removed');
          return reply.code(204).send();
        },
      );

      // --- ban list ------------------------------------------------------
      scoped.get<{ Params: { id: string } }>('/api/rooms/:id/bans', async (req, reply) => {
        if (!isAuthed(req)) return;
        const { id } = req.params;
        const callerId = req.user.id;

        const room = await loadRoom(id);
        if (!room) return reply.code(404).send({ error: 'not_found' });
        if (!(await isAdminOrOwner(id, callerId))) {
          return reply.code(403).send({ error: 'forbidden', code: 'not_admin' });
        }

        const target = alias(users, 'target');
        const banner = alias(users, 'banner');

        const rows = await db
          .select({
            targetId: roomBans.targetId,
            targetUsername: target.username,
            bannerId: roomBans.bannerId,
            bannerUsername: banner.username,
            reason: roomBans.reason,
            createdAt: roomBans.createdAt,
          })
          .from(roomBans)
          .innerJoin(target, eq(target.id, roomBans.targetId))
          .leftJoin(banner, eq(banner.id, roomBans.bannerId))
          .where(eq(roomBans.roomId, id))
          .orderBy(desc(roomBans.createdAt));

        const mapped = rows.map((r) => ({
          target: { id: r.targetId, username: r.targetUsername },
          banner:
            r.bannerId && r.bannerUsername ? { id: r.bannerId, username: r.bannerUsername } : null,
          reason: r.reason,
          createdAt: r.createdAt.toISOString(),
        }));

        return reply.send({ bans: mapped });
      });

      // --- unban ---------------------------------------------------------
      scoped.delete<{ Params: { id: string; userId: string } }>(
        '/api/rooms/:id/bans/:userId',
        async (req, reply) => {
          if (!isAuthed(req)) return;
          const { id, userId: targetId } = req.params;
          const callerId = req.user.id;

          const room = await loadRoom(id);
          if (!room) return reply.code(404).send({ error: 'not_found' });
          if (!(await isAdminOrOwner(id, callerId))) {
            return reply.code(403).send({ error: 'forbidden', code: 'not_admin' });
          }

          const deleted = await db
            .delete(roomBans)
            .where(and(eq(roomBans.roomId, id), eq(roomBans.targetId, targetId)))
            .returning({ targetId: roomBans.targetId });

          if (deleted.length === 0) {
            return reply.code(404).send({ error: 'not_found', code: 'not_banned' });
          }
          return reply.code(204).send();
        },
      );
    });
  },
});
