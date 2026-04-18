/**
 * Friends HTTP surface: requests, acceptances, friendships, bans, and user
 * search/profile. Every route requires authentication via `requireAuth`.
 *
 * The invariants live in the DB schema (see `docs/data-model.md` and
 * `friendships` / `user_bans` CHECKs). Route code layers the product rules on
 * top: a pending request is idempotent, existing friendships or user-bans
 * force a 409, accept is atomic (delete request + insert ordered friendship),
 * and banning collapses any prior relation in one transaction.
 */

import {
  type FriendRequestView,
  type FriendshipView,
  type UserPublic,
  friendRequestCreate,
  userBanCreate,
} from '@agora/shared';
import { and, asc, desc, eq, ne, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { FastifyInstance } from 'fastify';
import { uuidv7 } from 'uuidv7';
import { db } from '../db/client.js';
import { friendRequests, friendships, userBans, users } from '../db/schema.js';
import { addRouteModule } from '../routes/registry.js';
import { isAuthed, requireAuth } from '../session/require-auth.js';
import { areFriends, eitherSideBanned, isUniqueViolation, pairKey } from './db-helpers.js';
import {
  publishFriendRequestCancelled,
  publishFriendRequestReceived,
  publishFriendshipCreated,
  publishFriendshipRemoved,
  publishUserBanCreated,
  publishUserBanRemoved,
} from './events.js';

interface FriendRequestRow {
  id: string;
  senderId: string;
  recipientId: string;
  note: string | null;
  createdAt: Date;
}

const loadFriendRequest = async (id: string): Promise<FriendRequestRow | null> => {
  const rows = await db
    .select({
      id: friendRequests.id,
      senderId: friendRequests.senderId,
      recipientId: friendRequests.recipientId,
      note: friendRequests.note,
      createdAt: friendRequests.createdAt,
    })
    .from(friendRequests)
    .where(eq(friendRequests.id, id))
    .limit(1);
  return rows[0] ?? null;
};

const loadUserById = async (
  id: string,
): Promise<{ id: string; username: string; deletedAt: Date | null } | null> => {
  const rows = await db
    .select({ id: users.id, username: users.username, deletedAt: users.deletedAt })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return rows[0] ?? null;
};

const loadUserByUsername = async (
  username: string,
): Promise<{ id: string; username: string; deletedAt: Date | null } | null> => {
  const rows = await db
    .select({ id: users.id, username: users.username, deletedAt: users.deletedAt })
    .from(users)
    .where(sql`lower(${users.username}) = lower(${username})`)
    .limit(1);
  return rows[0] ?? null;
};

addRouteModule({
  name: 'friends',
  register(app: FastifyInstance): void {
    app.register(async (scoped) => {
      scoped.addHook('onRequest', requireAuth);

      // --- send friend request --------------------------------------------
      scoped.post('/api/friend-requests', async (req, reply) => {
        if (!isAuthed(req)) return;
        const parsed = friendRequestCreate.safeParse(req.body);
        if (!parsed.success) {
          return reply.code(400).send({
            error: 'validation',
            message: parsed.error.issues[0]?.message ?? 'invalid body',
          });
        }

        const senderId = req.user.id;
        const target = await loadUserByUsername(parsed.data.targetUsername);
        if (!target || target.deletedAt) {
          return reply.code(404).send({ error: 'not_found', code: 'user_not_found' });
        }
        if (target.id === senderId) {
          return reply.code(400).send({ error: 'validation', code: 'self_request' });
        }

        if (await eitherSideBanned(senderId, target.id)) {
          return reply.code(409).send({ error: 'conflict', code: 'banned' });
        }
        if (await areFriends(senderId, target.id)) {
          return reply.code(409).send({ error: 'conflict', code: 'already_friends' });
        }

        // Idempotent if the same sender → recipient request is already pending.
        const existing = await db
          .select({
            id: friendRequests.id,
            senderId: friendRequests.senderId,
            recipientId: friendRequests.recipientId,
            note: friendRequests.note,
            createdAt: friendRequests.createdAt,
          })
          .from(friendRequests)
          .where(
            and(eq(friendRequests.senderId, senderId), eq(friendRequests.recipientId, target.id)),
          )
          .limit(1);
        if (existing[0]) {
          return reply.code(200).send({
            id: existing[0].id,
            senderId: existing[0].senderId,
            recipientId: existing[0].recipientId,
            note: existing[0].note,
            createdAt: existing[0].createdAt.toISOString(),
          });
        }

        const id = uuidv7();
        const note = parsed.data.note ?? null;

        try {
          const [inserted] = await db
            .insert(friendRequests)
            .values({ id, senderId, recipientId: target.id, note })
            .returning();
          if (!inserted) throw new Error('friend request insert returned no row');

          publishFriendRequestReceived(target.id, {
            id: inserted.id,
            sender: { id: senderId, username: req.user.username },
            note: inserted.note,
          });

          return reply.code(201).send({
            id: inserted.id,
            senderId: inserted.senderId,
            recipientId: inserted.recipientId,
            note: inserted.note,
            createdAt: inserted.createdAt.toISOString(),
          });
        } catch (err) {
          if (isUniqueViolation(err)) {
            // Raced with a duplicate send; re-read and return the winner.
            const rows = await db
              .select({
                id: friendRequests.id,
                senderId: friendRequests.senderId,
                recipientId: friendRequests.recipientId,
                note: friendRequests.note,
                createdAt: friendRequests.createdAt,
              })
              .from(friendRequests)
              .where(
                and(
                  eq(friendRequests.senderId, senderId),
                  eq(friendRequests.recipientId, target.id),
                ),
              )
              .limit(1);
            const row = rows[0];
            if (row) {
              return reply.code(200).send({
                id: row.id,
                senderId: row.senderId,
                recipientId: row.recipientId,
                note: row.note,
                createdAt: row.createdAt.toISOString(),
              });
            }
          }
          throw err;
        }
      });

      // --- list friend requests (incoming|outgoing) -----------------------
      scoped.get('/api/friend-requests', async (req, reply) => {
        if (!isAuthed(req)) return;
        const query = req.query as { direction?: string };
        if (query.direction !== 'incoming' && query.direction !== 'outgoing') {
          return reply.code(400).send({
            error: 'validation',
            message: 'direction must be "incoming" or "outgoing"',
          });
        }

        const callerId = req.user.id;
        const sender = alias(users, 'sender');
        const recipient = alias(users, 'recipient');

        const whereClause =
          query.direction === 'incoming'
            ? eq(friendRequests.recipientId, callerId)
            : eq(friendRequests.senderId, callerId);

        const rows = await db
          .select({
            id: friendRequests.id,
            senderId: friendRequests.senderId,
            senderUsername: sender.username,
            recipientId: friendRequests.recipientId,
            recipientUsername: recipient.username,
            note: friendRequests.note,
            createdAt: friendRequests.createdAt,
          })
          .from(friendRequests)
          .innerJoin(sender, eq(sender.id, friendRequests.senderId))
          .innerJoin(recipient, eq(recipient.id, friendRequests.recipientId))
          .where(whereClause)
          .orderBy(desc(friendRequests.createdAt));

        const mapped: FriendRequestView[] = rows.map((r) => ({
          id: r.id,
          sender: { id: r.senderId, username: r.senderUsername },
          recipient: { id: r.recipientId, username: r.recipientUsername },
          note: r.note,
          createdAt: r.createdAt.toISOString(),
        }));

        return reply.send({ requests: mapped });
      });

      // --- accept friend request ------------------------------------------
      scoped.post<{ Params: { id: string } }>(
        '/api/friend-requests/:id/accept',
        async (req, reply) => {
          if (!isAuthed(req)) return;
          const { id } = req.params;
          const callerId = req.user.id;

          const request = await loadFriendRequest(id);
          if (!request) return reply.code(404).send({ error: 'not_found' });
          if (request.recipientId !== callerId) {
            return reply.code(403).send({ error: 'forbidden', code: 'not_recipient' });
          }

          if (await eitherSideBanned(request.senderId, request.recipientId)) {
            // Ban appeared between send and accept: drop the stale request.
            await db.delete(friendRequests).where(eq(friendRequests.id, id));
            return reply.code(409).send({ error: 'conflict', code: 'banned' });
          }

          const { a, b } = pairKey(request.senderId, request.recipientId);

          await db.transaction(async (tx) => {
            await tx.delete(friendRequests).where(eq(friendRequests.id, id));
            await tx
              .insert(friendships)
              .values({ userAId: a, userBId: b, establishedAt: new Date() })
              .onConflictDoNothing({ target: [friendships.userAId, friendships.userBId] });
          });

          publishFriendshipCreated(request.senderId, request.recipientId);
          publishFriendshipCreated(request.recipientId, request.senderId);

          return reply.code(200).send({
            userIds: [request.senderId, request.recipientId],
          });
        },
      );

      // --- reject friend request ------------------------------------------
      scoped.post<{ Params: { id: string } }>(
        '/api/friend-requests/:id/reject',
        async (req, reply) => {
          if (!isAuthed(req)) return;
          const { id } = req.params;
          const callerId = req.user.id;

          const request = await loadFriendRequest(id);
          if (!request) return reply.code(404).send({ error: 'not_found' });
          if (request.recipientId !== callerId) {
            return reply.code(403).send({ error: 'forbidden', code: 'not_recipient' });
          }

          await db.delete(friendRequests).where(eq(friendRequests.id, id));
          // Silent decline per FR-FRND-4: sender receives no broadcast.
          return reply.code(204).send();
        },
      );

      // --- cancel outgoing friend request ---------------------------------
      scoped.delete<{ Params: { id: string } }>('/api/friend-requests/:id', async (req, reply) => {
        if (!isAuthed(req)) return;
        const { id } = req.params;
        const callerId = req.user.id;

        const request = await loadFriendRequest(id);
        if (!request) return reply.code(404).send({ error: 'not_found' });
        if (request.senderId !== callerId) {
          return reply.code(403).send({ error: 'forbidden', code: 'not_sender' });
        }

        await db.delete(friendRequests).where(eq(friendRequests.id, id));
        publishFriendRequestCancelled(request.recipientId, request.id);
        return reply.code(204).send();
      });

      // --- list friends ---------------------------------------------------
      scoped.get('/api/friends', async (req, reply) => {
        if (!isAuthed(req)) return;
        const callerId = req.user.id;

        const counterparty = alias(users, 'counterparty');

        const rows = await db
          .select({
            counterpartyId: counterparty.id,
            counterpartyUsername: counterparty.username,
            establishedAt: friendships.establishedAt,
          })
          .from(friendships)
          .innerJoin(
            counterparty,
            sql`${counterparty.id} = CASE WHEN ${friendships.userAId} = ${callerId} THEN ${friendships.userBId} ELSE ${friendships.userAId} END`,
          )
          .where(or(eq(friendships.userAId, callerId), eq(friendships.userBId, callerId)))
          .orderBy(asc(counterparty.username));

        const mapped: FriendshipView[] = rows.map((r) => ({
          user: { id: r.counterpartyId, username: r.counterpartyUsername },
          establishedAt: r.establishedAt.toISOString(),
        }));

        return reply.send({ friends: mapped });
      });

      // --- unfriend -------------------------------------------------------
      scoped.delete<{ Params: { otherUserId: string } }>(
        '/api/friendships/:otherUserId',
        async (req, reply) => {
          if (!isAuthed(req)) return;
          const { otherUserId } = req.params;
          const callerId = req.user.id;

          if (otherUserId === callerId) {
            return reply.code(400).send({ error: 'validation', code: 'self_target' });
          }

          const { a, b } = pairKey(callerId, otherUserId);
          const deleted = await db
            .delete(friendships)
            .where(and(eq(friendships.userAId, a), eq(friendships.userBId, b)))
            .returning({ userAId: friendships.userAId });

          if (deleted.length === 0) {
            return reply.code(404).send({ error: 'not_found', code: 'not_friend' });
          }

          publishFriendshipRemoved(callerId, otherUserId);
          publishFriendshipRemoved(otherUserId, callerId);
          return reply.code(204).send();
        },
      );

      // --- ban user -------------------------------------------------------
      scoped.post('/api/user-bans', async (req, reply) => {
        if (!isAuthed(req)) return;
        const parsed = userBanCreate.safeParse(req.body);
        if (!parsed.success) {
          return reply.code(400).send({
            error: 'validation',
            message: parsed.error.issues[0]?.message ?? 'invalid body',
          });
        }

        const callerId = req.user.id;
        const targetId = parsed.data.targetUserId;
        if (targetId === callerId) {
          return reply.code(400).send({ error: 'validation', code: 'self_ban' });
        }

        const target = await loadUserById(targetId);
        if (!target || target.deletedAt) {
          return reply.code(404).send({ error: 'not_found', code: 'user_not_found' });
        }

        const reason = parsed.data.reason ?? null;
        const { a, b } = pairKey(callerId, targetId);

        await db.transaction(async (tx) => {
          await tx
            .delete(friendRequests)
            .where(
              or(
                and(
                  eq(friendRequests.senderId, callerId),
                  eq(friendRequests.recipientId, targetId),
                ),
                and(
                  eq(friendRequests.senderId, targetId),
                  eq(friendRequests.recipientId, callerId),
                ),
              ),
            );

          await tx
            .delete(friendships)
            .where(and(eq(friendships.userAId, a), eq(friendships.userBId, b)));

          await tx
            .insert(userBans)
            .values({ bannerId: callerId, targetId, reason })
            .onConflictDoNothing({ target: [userBans.bannerId, userBans.targetId] });
        });

        publishUserBanCreated(callerId, callerId, targetId);
        publishUserBanCreated(targetId, callerId, targetId);

        return reply.code(201).send({ bannerId: callerId, targetId });
      });

      // --- unban ----------------------------------------------------------
      scoped.delete<{ Params: { targetId: string } }>(
        '/api/user-bans/:targetId',
        async (req, reply) => {
          if (!isAuthed(req)) return;
          const { targetId } = req.params;
          const callerId = req.user.id;

          const deleted = await db
            .delete(userBans)
            .where(and(eq(userBans.bannerId, callerId), eq(userBans.targetId, targetId)))
            .returning({ targetId: userBans.targetId });

          if (deleted.length === 0) {
            return reply.code(404).send({ error: 'not_found', code: 'not_banned' });
          }

          publishUserBanRemoved(callerId, callerId, targetId);
          publishUserBanRemoved(targetId, callerId, targetId);
          return reply.code(204).send();
        },
      );

      // --- list user-bans involving the caller ----------------------------
      // ?direction=outgoing (default): bans I placed against others.
      // ?direction=incoming: bans others placed against me — needed by the
      //   client to render read-only banners on DMs the counterparty
      //   froze.
      scoped.get('/api/user-bans', async (req, reply) => {
        if (!isAuthed(req)) return;
        const callerId = req.user.id;
        const { direction = 'outgoing' } = req.query as { direction?: string };
        if (direction !== 'incoming' && direction !== 'outgoing') {
          return reply
            .code(400)
            .send({ error: 'validation', message: 'direction must be incoming or outgoing' });
        }

        if (direction === 'incoming') {
          const banner = alias(users, 'banner');
          const rows = await db
            .select({
              bannerId: userBans.bannerId,
              bannerUsername: banner.username,
              reason: userBans.reason,
              createdAt: userBans.createdAt,
            })
            .from(userBans)
            .innerJoin(banner, eq(banner.id, userBans.bannerId))
            .where(eq(userBans.targetId, callerId))
            .orderBy(desc(userBans.createdAt));

          const mapped = rows.map((r) => ({
            banner: { id: r.bannerId, username: r.bannerUsername },
            reason: r.reason,
            createdAt: r.createdAt.toISOString(),
          }));
          return reply.send({ bans: mapped });
        }

        const target = alias(users, 'target');

        const rows = await db
          .select({
            targetId: userBans.targetId,
            targetUsername: target.username,
            reason: userBans.reason,
            createdAt: userBans.createdAt,
          })
          .from(userBans)
          .innerJoin(target, eq(target.id, userBans.targetId))
          .where(eq(userBans.bannerId, callerId))
          .orderBy(desc(userBans.createdAt));

        const mapped = rows.map((r) => ({
          target: { id: r.targetId, username: r.targetUsername },
          reason: r.reason,
          createdAt: r.createdAt.toISOString(),
        }));

        return reply.send({ bans: mapped });
      });

      // --- search users ---------------------------------------------------
      // Throttled because returning prefix matches is an enumeration surface:
      // anyone who can send two characters can walk the user table otherwise.
      // 30/min per IP is plenty for a real user typing in a search box.
      scoped.get(
        '/api/users/search',
        { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
        async (req, reply) => {
        if (!isAuthed(req)) return;
        const query = req.query as { q?: string; limit?: string };
        const rawQ = typeof query.q === 'string' ? query.q.trim() : '';
        if (rawQ.length < 2) {
          // Require at least 2 characters so typing 'a' doesn't fire a full
          // ILIKE scan and also to slow prefix-walking enumeration attempts.
          return reply.send({ users: [] });
        }

        const parsedLimit = Number.parseInt(query.limit ?? '', 10);
        const limit =
          Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 25) : 25;

        const callerId = req.user.id;

        const rows = await db
          .select({ id: users.id, username: users.username })
          .from(users)
          .where(
            and(
              sql`lower(${users.username}) like lower(${`${rawQ}%`})`,
              sql`${users.deletedAt} IS NULL`,
              ne(users.id, callerId),
              sql`NOT EXISTS (
                SELECT 1 FROM ${userBans}
                WHERE ${userBans.bannerId} = ${users.id}
                  AND ${userBans.targetId} = ${callerId}
              )`,
            ),
          )
          .orderBy(asc(users.username))
          .limit(limit);

        const mapped: UserPublic[] = rows.map((r) => ({ id: r.id, username: r.username }));
        return reply.send({ users: mapped });
        },
      );

      // --- user profile ---------------------------------------------------
      scoped.get<{ Params: { username: string } }>('/api/users/:username', async (req, reply) => {
        if (!isAuthed(req)) return;
        const { username } = req.params;

        const rows = await db
          .select({
            id: users.id,
            username: users.username,
            createdAt: users.createdAt,
            deletedAt: users.deletedAt,
          })
          .from(users)
          .where(sql`lower(${users.username}) = lower(${username})`)
          .limit(1);
        const row = rows[0];
        if (!row || row.deletedAt) {
          return reply.code(404).send({ error: 'not_found' });
        }
        return reply.send({
          id: row.id,
          username: row.username,
          createdAt: row.createdAt.toISOString(),
        });
      });
    });
  },
});
