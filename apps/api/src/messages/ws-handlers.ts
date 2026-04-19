/**
 * WebSocket handlers for messaging: send/edit/delete/mark-read. Each handler
 * is registered at module scope via `registerWsHandler`. Events arrive
 * pre-validated through the shared zod discriminated union, so handlers
 * consume typed variants rather than casting from `unknown`.
 */

import type { MessageView } from '@agora/shared';
import { and, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import { db } from '../db/client.js';
import { bus } from '../bus/bus.js';
import { dmTopic, roomTopic, userTopic } from '../bus/topics.js';
import { attachments, lastRead, messages, roomMembers, users } from '../db/schema.js';
import { registerWsHandler, type WsContext } from '../ws/dispatcher.js';
import { extractMentions } from '../notifications/mention.js';
import { publishNotification } from '../notifications/publisher.js';
import { isUniqueViolation } from '../friends/db-helpers.js';
import { hydrateMessage } from './history.js';
import { canAccessDm, canAccessRoom, canSendDm, loadDmForUser } from './permissions.js';
import { lookupDedupe, rememberDedupe } from './send-dedupe.js';
import { incrementUnreadForMany, listOtherParticipants, resetUnread } from './unread.js';

const sendAck = (ctx: WsContext, reqId: string | undefined, result?: unknown): void => {
  if (!reqId) return;
  ctx.conn.send({ type: 'ack', payload: { reqId, result } });
};

const sendErr = (
  ctx: WsContext,
  reqId: string | undefined,
  code: string,
  message: string,
): void => {
  ctx.conn.send({
    type: 'err',
    payload: reqId ? { reqId, code, message } : { code, message },
  });
};

const publishNewMessage = (view: MessageView): void => {
  const topic =
    view.conversationType === 'room' ? roomTopic(view.conversationId) : dmTopic(view.conversationId);
  bus.publish(topic, { type: 'message.new', payload: view });
};

const publishUpdated = (view: MessageView): void => {
  const topic =
    view.conversationType === 'room' ? roomTopic(view.conversationId) : dmTopic(view.conversationId);
  bus.publish(topic, { type: 'message.updated', payload: view });
};

const publishDeleted = (view: MessageView): void => {
  const topic =
    view.conversationType === 'room' ? roomTopic(view.conversationId) : dmTopic(view.conversationId);
  bus.publish(topic, {
    type: 'message.deleted',
    payload: {
      id: view.id,
      conversationType: view.conversationType,
      conversationId: view.conversationId,
    },
  });
};

// ---- message.send ---------------------------------------------------------

registerWsHandler('message.send', async (ctx, event) => {
  const { reqId, payload } = event;
  const userId = ctx.conn.userId;

  const permission =
    payload.conversationType === 'room'
      ? await canAccessRoom(userId, payload.conversationId)
      : await (async () => {
          const loaded = await loadDmForUser(userId, payload.conversationId);
          if (!loaded.ok) return loaded;
          return canSendDm(userId, loaded.otherUserId);
        })();
  if (!permission.ok) {
    // The client receives an `err` with the permission code; that is the
    // canonical signal. Do not log per-deny to stderr — a misbehaving or
    // malicious client can flood stderr by retrying forbidden sends.
    sendErr(ctx, reqId, permission.code, 'not allowed');
    return;
  }

  if (payload.replyToId) {
    const [target] = await db
      .select({
        id: messages.id,
        conversationType: messages.conversationType,
        conversationId: messages.conversationId,
      })
      .from(messages)
      .where(eq(messages.id, payload.replyToId))
      .limit(1);
    if (
      !target ||
      target.conversationType !== payload.conversationType ||
      target.conversationId !== payload.conversationId
    ) {
      sendErr(ctx, reqId, 'not_found', 'reply target not found in this conversation');
      return;
    }
  }

  if (payload.clientMessageId) {
    const existing = lookupDedupe(userId, payload.clientMessageId);
    if (existing) {
      const [row] = await db
        .select()
        .from(messages)
        .where(eq(messages.id, existing))
        .limit(1);
      if (row && !row.deletedAt) {
        const view = await hydrateMessage(row);
        sendAck(ctx, reqId, view);
        return;
      }
      // LRU pointed at a now-deleted or vanished row – fall through to a
      // fresh insert; the DB unique index will still backstop.
    }
  }

  const trimmedBody = payload.body.replace(/^[ \t]+|[ \t]+$/g, '');
  const id = uuidv7();
  const now = new Date();

  let insertResult: {
    row: typeof messages.$inferSelect;
    counts: { userId: string; count: number }[];
  };
  try {
    insertResult = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(messages)
      .values({
        id,
        conversationType: payload.conversationType,
        conversationId: payload.conversationId,
        authorId: userId,
        body: trimmedBody,
        replyToId: payload.replyToId ?? null,
        createdAt: now,
        clientMessageId: payload.clientMessageId ?? null,
      })
      .returning();
    if (!inserted) throw new Error('message insert returned no rows');

    if (payload.attachmentIds && payload.attachmentIds.length > 0) {
      // Link only attachments the caller uploaded and that haven't been
      // linked to another message yet. Quietly skips ids that don't match
      // — the orphan sweeper cleans up genuinely dangling uploads.
      await tx
        .update(attachments)
        .set({ messageId: inserted.id })
        .where(
          and(
            inArray(attachments.id, payload.attachmentIds),
            eq(attachments.uploaderId, userId),
            isNull(attachments.messageId),
          ),
        );
    }

    const recipients = await listOtherParticipants(
      tx,
      payload.conversationType,
      payload.conversationId,
      userId,
    );
    const byUser = await incrementUnreadForMany(
      tx,
      recipients,
      payload.conversationType,
      payload.conversationId,
    );
    const counts = recipients.map((rid) => ({ userId: rid, count: byUser.get(rid) ?? 0 }));
    return { row: inserted, counts };
    });
  } catch (err) {
    if (payload.clientMessageId && isUniqueViolation(err)) {
      const [row] = await db
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.authorId, userId),
            eq(messages.clientMessageId, payload.clientMessageId),
          ),
        )
        .limit(1);
      if (row) {
        const view = await hydrateMessage(row);
        rememberDedupe(userId, payload.clientMessageId, row.id);
        sendAck(ctx, reqId, view);
        return;
      }
    }
    throw err;
  }

  const view = await hydrateMessage(insertResult.row);
  publishNewMessage(view);

  if (payload.clientMessageId) {
    rememberDedupe(userId, payload.clientMessageId, insertResult.row.id);
  }

  for (const { userId: rid, count } of insertResult.counts) {
    bus.publish(userTopic(rid), {
      type: 'unread.updated',
      payload: {
        conversationType: payload.conversationType,
        conversationId: payload.conversationId,
        count,
      },
    });
  }

  if (payload.conversationType === 'dm') {
    for (const { userId: rid } of insertResult.counts) {
      await publishNotification({
        userId: rid,
        kind: 'dm.new_message',
        subjectType: 'dm',
        subjectId: payload.conversationId,
        actorId: userId,
        payload: {
          senderUsername: view.author?.username ?? 'unknown',
          snippet: trimmedBody.slice(0, 120),
        },
      });
    }
  } else if (payload.conversationType === 'room' && trimmedBody) {
    const mentioned = extractMentions(trimmedBody);
    if (mentioned.length > 0) {
      const targets = await db
        .select({ id: users.id, username: users.username })
        .from(users)
        .innerJoin(
          roomMembers,
          and(
            eq(roomMembers.userId, users.id),
            eq(roomMembers.roomId, payload.conversationId),
          ),
        )
        .where(
          and(
            inArray(sql`lower(${users.username})`, mentioned),
            ne(users.id, userId),
          ),
        );
      for (const target of targets) {
        await publishNotification({
          userId: target.id,
          kind: 'room.mentioned',
          subjectType: 'room',
          subjectId: payload.conversationId,
          actorId: userId,
          payload: {
            senderUsername: view.author?.username ?? 'unknown',
            snippet: trimmedBody.slice(0, 120),
          },
        });
      }
    }
  }

  sendAck(ctx, reqId, view);
});

// ---- message.edit ---------------------------------------------------------

registerWsHandler('message.edit', async (ctx, event) => {
  const { reqId, payload } = event;
  const userId = ctx.conn.userId;

  const [existing] = await db
    .select()
    .from(messages)
    .where(eq(messages.id, payload.id))
    .limit(1);
  if (!existing || existing.deletedAt) {
    sendErr(ctx, reqId, 'not_found', 'message not found');
    return;
  }
  if (existing.authorId !== userId) {
    sendErr(ctx, reqId, 'not_member', 'only the author can edit');
    return;
  }

  // Re-check conversation access: a user banned or removed after authoring
  // must not be able to edit prior messages. Mirrors message.send's posture
  // so moderation (FR-ROOM-14 / FR-FRND-6) flows end-to-end.
  const access =
    existing.conversationType === 'room'
      ? await canAccessRoom(userId, existing.conversationId)
      : await canAccessDm(userId, existing.conversationId);
  if (!access.ok) {
    sendErr(ctx, reqId, access.code, 'not allowed');
    return;
  }

  const trimmedBody = payload.body.replace(/^[ \t]+|[ \t]+$/g, '');
  const editedAt = new Date();
  const [updated] = await db
    .update(messages)
    .set({ body: trimmedBody, editedAt })
    .where(eq(messages.id, payload.id))
    .returning();
  if (!updated) {
    sendErr(ctx, reqId, 'not_found', 'message vanished during update');
    return;
  }

  const view = await hydrateMessage(updated);
  publishUpdated(view);
  sendAck(ctx, reqId, view);
});

// ---- message.delete -------------------------------------------------------

registerWsHandler('message.delete', async (ctx, event) => {
  const { reqId, payload } = event;
  const userId = ctx.conn.userId;

  const [existing] = await db
    .select()
    .from(messages)
    .where(eq(messages.id, payload.id))
    .limit(1);
  if (!existing || existing.deletedAt) {
    sendErr(ctx, reqId, 'not_found', 'message not found');
    return;
  }

  // Re-check conversation access before any author/admin branch. A banned
  // author cannot delete their own prior messages; admins who lost access
  // (e.g. left the room) cannot delete either.
  const access =
    existing.conversationType === 'room'
      ? await canAccessRoom(userId, existing.conversationId)
      : await canAccessDm(userId, existing.conversationId);
  if (!access.ok) {
    sendErr(ctx, reqId, access.code, 'not allowed');
    return;
  }

  const isAuthor = existing.authorId === userId;
  let allowed = isAuthor;
  if (!allowed && existing.conversationType === 'room') {
    const [membership] = await db
      .select({ role: roomMembers.role })
      .from(roomMembers)
      .where(
        and(eq(roomMembers.roomId, existing.conversationId), eq(roomMembers.userId, userId)),
      )
      .limit(1);
    if (membership && (membership.role === 'owner' || membership.role === 'admin')) {
      allowed = true;
    }
  }
  if (!allowed) {
    sendErr(ctx, reqId, 'not_member', 'only author or room admin can delete');
    return;
  }

  const deletedAt = new Date();
  const [updated] = await db
    .update(messages)
    .set({ body: '', deletedAt })
    .where(eq(messages.id, payload.id))
    .returning();
  if (!updated) {
    sendErr(ctx, reqId, 'not_found', 'message vanished during delete');
    return;
  }

  const view = await hydrateMessage(updated);
  publishDeleted(view);
  sendAck(ctx, reqId, { id: updated.id });
});

// ---- mark.read ------------------------------------------------------------

registerWsHandler('mark.read', async (ctx, event) => {
  const { payload } = event;
  const userId = ctx.conn.userId;

  await db
    .insert(lastRead)
    .values({
      userId,
      conversationType: payload.conversationType,
      conversationId: payload.conversationId,
      lastReadMessageId: payload.messageId,
    })
    .onConflictDoUpdate({
      target: [lastRead.userId, lastRead.conversationType, lastRead.conversationId],
      set: { lastReadMessageId: payload.messageId, updatedAt: new Date() },
    });

  await resetUnread(userId, payload.conversationType, payload.conversationId);

  bus.publish(userTopic(userId), {
    type: 'unread.updated',
    payload: {
      conversationType: payload.conversationType,
      conversationId: payload.conversationId,
      count: 0,
    },
  });
});
