/**
 * HTTP routes for messaging. The canonical delivery path is WebSocket; HTTP
 * is used for history fetch (initial load + infinite scroll + reconnect
 * backfill), for opening a DM, and for the sidebar conversation list.
 *
 * Permission checks run on every request (AC-6). There is no caching.
 */

import type { FastifyInstance } from 'fastify';
import { and, eq, inArray, or, sql } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import { z } from 'zod';
import { conversationType as conversationTypeSchema } from '@agora/shared';
import { db } from '../db/client.js';
import {
  conversationUnreads,
  dmConversations,
  lastRead,
  roomMembers,
  rooms,
  userBans,
  users,
} from '../db/schema.js';
import { addRouteModule } from '../routes/registry.js';
import { requireAuth } from '../session/require-auth.js';
import { fetchHistory } from './history.js';
import { canAccessRoom, canSendDm, loadDmForUser } from './permissions.js';
import { connections, subscribeConnection } from '../ws/connection-manager.js';
import { dmTopic } from '../bus/topics.js';

const MAX_HISTORY_LIMIT = 100;
const MAX_SINCE_LIMIT = 500;
const DEFAULT_HISTORY_LIMIT = 50;
const DEFAULT_SINCE_LIMIT = 200;

const historyQuery = z
  .object({
    before: z.string().uuid().optional(),
    since: z.string().uuid().optional(),
    limit: z.coerce.number().int().positive().optional(),
  })
  .refine((v) => !(v.before && v.since), {
    message: 'before and since are mutually exclusive',
  });

const pathParams = z.object({
  type: conversationTypeSchema,
  id: z.string().uuid(),
});

const openDmBody = z.object({
  otherUserId: z.string().uuid(),
});

type PreviewRow = {
  conversation_type: 'room' | 'dm';
  conversation_id: string;
  id: string;
  body: string;
  created_at: Date;
  author_id: string | null;
  deleted_at: Date | null;
  [key: string]: unknown;
};

addRouteModule({
  name: 'messages',
  register(app: FastifyInstance) {
    // GET /api/conversations/:type/:id/messages
    app.get(
      '/api/conversations/:type/:id/messages',
      { preHandler: requireAuth },
      async (req, reply) => {
        if (!req.user) return reply.code(401).send({ error: 'unauthenticated' });
        const callerId = req.user.id;

        const params = pathParams.safeParse(req.params);
        if (!params.success) {
          return reply.code(400).send({ error: 'validation', message: 'invalid path params' });
        }
        const query = historyQuery.safeParse(req.query);
        if (!query.success) {
          return reply
            .code(400)
            .send({ error: 'validation', message: query.error.issues[0]?.message ?? 'bad query' });
        }

        const permission =
          params.data.type === 'room'
            ? await canAccessRoom(callerId, params.data.id)
            : await (async () => {
                const loaded = await loadDmForUser(callerId, params.data.id);
                if (!loaded.ok) return loaded;
                return canSendDm(callerId, loaded.otherUserId);
              })();
        if (!permission.ok) {
          const status = permission.code === 'not_found' ? 404 : 403;
          return reply.code(status).send({ error: permission.code });
        }

        const isSince = Boolean(query.data.since);
        const defaultLimit = isSince ? DEFAULT_SINCE_LIMIT : DEFAULT_HISTORY_LIMIT;
        const maxLimit = isSince ? MAX_SINCE_LIMIT : MAX_HISTORY_LIMIT;
        const limit = Math.min(query.data.limit ?? defaultLimit, maxLimit);

        const rows = await fetchHistory({
          conversationType: params.data.type,
          conversationId: params.data.id,
          ...(query.data.before ? { before: query.data.before } : {}),
          ...(query.data.since ? { since: query.data.since } : {}),
          limit,
        });
        return reply.send({ messages: rows });
      },
    );

    // POST /api/dm/open
    app.post('/api/dm/open', { preHandler: requireAuth }, async (req, reply) => {
      if (!req.user) return reply.code(401).send({ error: 'unauthenticated' });
      const body = openDmBody.safeParse(req.body);
      if (!body.success) {
        return reply.code(400).send({ error: 'validation' });
      }
      const selfId = req.user.id;
      const otherId = body.data.otherUserId;
      if (selfId === otherId) {
        return reply.code(400).send({ error: 'validation', message: 'cannot DM yourself' });
      }

      const permission = await canSendDm(selfId, otherId);
      if (!permission.ok) {
        return reply.code(403).send({ error: permission.code });
      }

      const [a, b] = selfId < otherId ? [selfId, otherId] : [otherId, selfId];

      const existing = await db
        .select({ id: dmConversations.id })
        .from(dmConversations)
        .where(and(eq(dmConversations.userAId, a), eq(dmConversations.userBId, b)))
        .limit(1);
      if (existing[0]) {
        return reply.send({ id: existing[0].id, created: false });
      }

      const id = uuidv7();
      await db
        .insert(dmConversations)
        .values({ id, userAId: a, userBId: b })
        .onConflictDoNothing();

      const reread = await db
        .select({ id: dmConversations.id })
        .from(dmConversations)
        .where(and(eq(dmConversations.userAId, a), eq(dmConversations.userBId, b)))
        .limit(1);
      const row = reread[0];
      if (!row) {
        return reply.code(500).send({ error: 'internal' });
      }

      // Auto-subscribe both participants' live WS connections to this DM topic
      for (const uid of [a, b]) {
        for (const conn of connections.forUser(uid)) {
          subscribeConnection(conn, dmTopic(row.id));
        }
      }

      return reply.send({ id: row.id, created: row.id === id });
    });

    // GET /api/conversations — rooms I'm in + DMs I have with unread + last message preview
    app.get('/api/conversations', { preHandler: requireAuth }, async (req, reply) => {
      if (!req.user) return reply.code(401).send({ error: 'unauthenticated' });
      const userId = req.user.id;

      const memberRows = await db
        .select({
          id: rooms.id,
          name: rooms.name,
          description: rooms.description,
          visibility: rooms.visibility,
        })
        .from(roomMembers)
        .innerJoin(rooms, eq(roomMembers.roomId, rooms.id))
        .where(eq(roomMembers.userId, userId));

      const dmRows = await db
        .select({
          id: dmConversations.id,
          userAId: dmConversations.userAId,
          userBId: dmConversations.userBId,
        })
        .from(dmConversations)
        .where(or(eq(dmConversations.userAId, userId), eq(dmConversations.userBId, userId)));

      const otherUserIds = dmRows.map((r) => (r.userAId === userId ? r.userBId : r.userAId));
      const usernameRows = otherUserIds.length
        ? await db
            .select({ id: users.id, username: users.username })
            .from(users)
            .where(inArray(users.id, otherUserIds))
        : [];
      const usernamesById = new Map(usernameRows.map((u) => [u.id, u.username]));

      // Any user-ban between caller and DM counterparty (either direction)
      // means the sidebar preview must hide the last-message body — per-spec
      // history stays accessible but the preview is an unnecessary extra
      // surface. Gathered upfront so the preview-mapping below stays simple.
      const bannedPairs = otherUserIds.length
        ? await db
            .select({ a: userBans.bannerId, b: userBans.targetId })
            .from(userBans)
            .where(
              or(
                and(eq(userBans.bannerId, userId), inArray(userBans.targetId, otherUserIds)),
                and(eq(userBans.targetId, userId), inArray(userBans.bannerId, otherUserIds)),
              ),
            )
        : [];
      const bannedOtherIds = new Set<string>();
      for (const p of bannedPairs) {
        bannedOtherIds.add(p.a === userId ? p.b : p.a);
      }

      const allIds = [...memberRows.map((r) => r.id), ...dmRows.map((r) => r.id)];
      const unreadRows = allIds.length
        ? await db
            .select({
              conversationType: conversationUnreads.conversationType,
              conversationId: conversationUnreads.conversationId,
              count: conversationUnreads.count,
            })
            .from(conversationUnreads)
            .where(
              and(
                eq(conversationUnreads.userId, userId),
                inArray(conversationUnreads.conversationId, allIds),
              ),
            )
        : [];
      const unreadByKey = new Map<string, number>();
      for (const u of unreadRows) {
        unreadByKey.set(`${u.conversationType}:${u.conversationId}`, u.count);
      }

      const lastReadRows = allIds.length
        ? await db
            .select({
              conversationType: lastRead.conversationType,
              conversationId: lastRead.conversationId,
              lastReadMessageId: lastRead.lastReadMessageId,
            })
            .from(lastRead)
            .where(and(eq(lastRead.userId, userId), inArray(lastRead.conversationId, allIds)))
        : [];
      const lastReadByKey = new Map<string, string | null>();
      for (const r of lastReadRows) {
        lastReadByKey.set(`${r.conversationType}:${r.conversationId}`, r.lastReadMessageId ?? null);
      }

      // LATERAL per-conversation subquery. Cheaper than DISTINCT ON over
      // unbounded history because each LATERAL picks the single latest row
      // using the (conversation_type, conversation_id, id) index range.
      const previewResult = allIds.length
        ? await db.execute<PreviewRow>(sql`
            SELECT c.conversation_type, c.conversation_id,
                   m.id, m.body, m.created_at, m.author_id, m.deleted_at
            FROM (VALUES ${sql.join(
              memberRows
                .map((r) => sql`(${'room'}::conversation_type, ${r.id}::uuid)`)
                .concat(
                  dmRows.map((r) => sql`(${'dm'}::conversation_type, ${r.id}::uuid)`),
                ),
              sql`, `,
            )}) AS c(conversation_type, conversation_id)
            LEFT JOIN LATERAL (
              SELECT id, body, created_at, author_id, deleted_at
              FROM messages m
              WHERE m.conversation_type = c.conversation_type
                AND m.conversation_id = c.conversation_id
              ORDER BY m.id DESC
              LIMIT 1
            ) m ON TRUE
            WHERE m.id IS NOT NULL
          `)
        : null;
      const previewRows: PreviewRow[] = previewResult ? previewResult.rows : [];
      const previewByKey = new Map<
        string,
        { id: string; body: string; createdAt: string; authorId: string | null; deleted: boolean }
      >();
      for (const p of previewRows) {
        previewByKey.set(`${p.conversation_type}:${p.conversation_id}`, {
          id: p.id,
          body: p.deleted_at ? '' : p.body,
          createdAt: new Date(p.created_at).toISOString(),
          authorId: p.author_id ?? null,
          deleted: Boolean(p.deleted_at),
        });
      }

      const roomEntries = memberRows.map((r) => {
        const key = `room:${r.id}`;
        return {
          type: 'room' as const,
          id: r.id,
          name: r.name,
          description: r.description,
          visibility: r.visibility,
          unreadCount: unreadByKey.get(key) ?? 0,
          lastReadMessageId: lastReadByKey.get(key) ?? null,
          preview: previewByKey.get(key) ?? null,
        };
      });

      const dmEntries = dmRows.map((r) => {
        const otherUserId = r.userAId === userId ? r.userBId : r.userAId;
        const key = `dm:${r.id}`;
        const rawPreview = previewByKey.get(key) ?? null;
        const preview =
          rawPreview && bannedOtherIds.has(otherUserId)
            ? { ...rawPreview, body: '' }
            : rawPreview;
        return {
          type: 'dm' as const,
          id: r.id,
          otherUser: {
            id: otherUserId,
            username: usernamesById.get(otherUserId) ?? '(unknown)',
          },
          unreadCount: unreadByKey.get(key) ?? 0,
          lastReadMessageId: lastReadByKey.get(key) ?? null,
          preview,
        };
      });

      return reply.send({ rooms: roomEntries, dms: dmEntries });
    });
  },
});
