/**
 * WebSocket handlers for messaging: send/edit/delete/mark-read. Each handler
 * is registered at module scope via `registerWsHandler`; the ws plugin routes
 * incoming client events through the dispatcher.
 *
 * Handlers are defensive about transport-level failure modes (validation, bad
 * ids) but trust framework guarantees for auth (ctx.conn.userId is set by the
 * plugin before a handler sees the connection).
 */

import type { MessageView } from '@agora/shared';
import { and, eq } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import { db } from '../db/client.js';
import { bus } from '../bus/bus.js';
import { dmTopic, roomTopic, userTopic } from '../bus/topics.js';
import { lastRead, messages, roomMembers } from '../db/schema.js';
import { registerWsHandler, type WsContext } from '../ws/dispatcher.js';
import { hydrateMessage } from './history.js';
import { canAccessRoom, canSendDm, loadDmForUser } from './permissions.js';
import { incrementUnreadForMany, listOtherParticipants, resetUnread } from './unread.js';

type ReqEvent = { type: string; reqId?: string; payload: unknown };

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
  const topic = view.conversationType === 'room' ? roomTopic(view.conversationId) : dmTopic(view.conversationId);
  bus.publish(topic, { type: 'message.new', payload: view });
};

const publishUpdated = (view: MessageView): void => {
  const topic = view.conversationType === 'room' ? roomTopic(view.conversationId) : dmTopic(view.conversationId);
  bus.publish(topic, { type: 'message.updated', payload: view });
};

const publishDeleted = (view: MessageView): void => {
  const topic = view.conversationType === 'room' ? roomTopic(view.conversationId) : dmTopic(view.conversationId);
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

registerWsHandler('message.send', async (ctx, raw) => {
  const evt = raw as ReqEvent;
  const payload = evt.payload as {
    conversationType: 'room' | 'dm';
    conversationId: string;
    body: string;
    replyToId?: string;
    attachmentIds?: string[];
  };
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
    sendErr(ctx, evt.reqId, permission.code, 'not allowed');
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
      sendErr(ctx, evt.reqId, 'not_found', 'reply target not found in this conversation');
      return;
    }
  }

  const trimmedBody = payload.body.replace(/^[ \t]+|[ \t]+$/g, '');
  const id = uuidv7();
  const now = new Date();

  const insertResult = await db.transaction(async (tx) => {
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
      })
      .returning();
    if (!inserted) throw new Error('message insert returned no rows');

    const recipients = await listOtherParticipants(
      tx,
      payload.conversationType,
      payload.conversationId,
      userId,
    );
    // Single batched INSERT ... ON CONFLICT instead of N round-trips.
    const byUser = await incrementUnreadForMany(
      tx,
      recipients,
      payload.conversationType,
      payload.conversationId,
    );
    const counts = recipients.map((rid) => ({ userId: rid, count: byUser.get(rid) ?? 0 }));
    return { row: inserted, counts };
  });

  const view = await hydrateMessage(insertResult.row);
  publishNewMessage(view);

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

  sendAck(ctx, evt.reqId, view);
});

// ---- message.edit ---------------------------------------------------------

registerWsHandler('message.edit', async (ctx, raw) => {
  const evt = raw as ReqEvent;
  const payload = evt.payload as { id: string; body: string };
  const userId = ctx.conn.userId;

  const [existing] = await db
    .select()
    .from(messages)
    .where(eq(messages.id, payload.id))
    .limit(1);
  if (!existing || existing.deletedAt) {
    sendErr(ctx, evt.reqId, 'not_found', 'message not found');
    return;
  }
  if (existing.authorId !== userId) {
    sendErr(ctx, evt.reqId, 'not_member', 'only the author can edit');
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
    sendErr(ctx, evt.reqId, 'not_found', 'message vanished during update');
    return;
  }

  const view = await hydrateMessage(updated);
  publishUpdated(view);
  sendAck(ctx, evt.reqId, view);
});

// ---- message.delete -------------------------------------------------------

registerWsHandler('message.delete', async (ctx, raw) => {
  const evt = raw as ReqEvent;
  const payload = evt.payload as { id: string };
  const userId = ctx.conn.userId;

  const [existing] = await db
    .select()
    .from(messages)
    .where(eq(messages.id, payload.id))
    .limit(1);
  if (!existing || existing.deletedAt) {
    sendErr(ctx, evt.reqId, 'not_found', 'message not found');
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
    sendErr(ctx, evt.reqId, 'not_member', 'only author or room admin can delete');
    return;
  }

  const deletedAt = new Date();
  const [updated] = await db
    .update(messages)
    .set({ body: '', deletedAt })
    .where(eq(messages.id, payload.id))
    .returning();
  if (!updated) {
    sendErr(ctx, evt.reqId, 'not_found', 'message vanished during delete');
    return;
  }

  const view = await hydrateMessage(updated);
  publishDeleted(view);
  sendAck(ctx, evt.reqId, { id: updated.id });
});

// ---- mark.read ------------------------------------------------------------

registerWsHandler('mark.read', async (ctx, raw) => {
  const evt = raw as ReqEvent;
  const payload = evt.payload as {
    conversationType: 'room' | 'dm';
    conversationId: string;
    messageId: string;
  };
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
