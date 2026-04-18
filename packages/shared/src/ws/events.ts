import { z } from 'zod';
import { reqIdSchema } from './envelope.js';
import { presenceState, presenceEntry } from '../presence/index.js';
import { userPublic } from '../users/index.js';
import { messageView, sendMessagePayload, editMessagePayload, deleteMessagePayload, markReadPayload } from '../messages/index.js';
import { clientFocusEvent } from '../notifications/index.js';

// --- client → server events ---------------------------------------------------

export const helloEvent = z.object({
  type: z.literal('hello'),
  reqId: reqIdSchema,
  payload: z.object({
    tabId: z.string().min(8).max(64),
    openConversationIds: z.array(z.string().uuid()).default([]),
  }),
});

export const heartbeatEvent = z.object({
  type: z.literal('heartbeat'),
  payload: z.object({}).default({}),
});

export const subscribeEvent = z.object({
  type: z.literal('subscribe'),
  reqId: reqIdSchema,
  payload: z.object({ topic: z.string() }),
});

export const unsubscribeEvent = z.object({
  type: z.literal('unsubscribe'),
  reqId: reqIdSchema,
  payload: z.object({ topic: z.string() }),
});

export const messageSendEvent = z.object({
  type: z.literal('message.send'),
  reqId: reqIdSchema,
  payload: sendMessagePayload,
});

export const messageEditEvent = z.object({
  type: z.literal('message.edit'),
  reqId: reqIdSchema,
  payload: editMessagePayload,
});

export const messageDeleteEvent = z.object({
  type: z.literal('message.delete'),
  reqId: reqIdSchema,
  payload: deleteMessagePayload,
});

export const markReadEvent = z.object({
  type: z.literal('mark.read'),
  payload: markReadPayload,
});

export const clientToServerEvent = z.discriminatedUnion('type', [
  helloEvent,
  heartbeatEvent,
  subscribeEvent,
  unsubscribeEvent,
  messageSendEvent,
  messageEditEvent,
  messageDeleteEvent,
  markReadEvent,
  clientFocusEvent,
]);

export type HelloEvent = z.infer<typeof helloEvent>;
export type HeartbeatEvent = z.infer<typeof heartbeatEvent>;
export type MessageSendEvent = z.infer<typeof messageSendEvent>;
export type MessageEditEvent = z.infer<typeof messageEditEvent>;
export type MessageDeleteEvent = z.infer<typeof messageDeleteEvent>;
export type MarkReadEvent = z.infer<typeof markReadEvent>;
export type ClientToServerEvent = z.infer<typeof clientToServerEvent>;

// --- server → client events ---------------------------------------------------

export const presenceUpdateEvent = z.object({
  type: z.literal('presence.update'),
  payload: z.object({ userId: z.string().uuid(), state: presenceState }),
});

export const presenceSnapshotEvent = z.object({
  type: z.literal('presence.snapshot'),
  payload: z.object({ entries: z.array(presenceEntry) }),
});

export const messageNewEvent = z.object({
  type: z.literal('message.new'),
  payload: messageView,
});

export const messageUpdatedEvent = z.object({
  type: z.literal('message.updated'),
  payload: messageView,
});

export const messageDeletedEvent = z.object({
  type: z.literal('message.deleted'),
  payload: z.object({
    id: z.string().uuid(),
    conversationType: z.enum(['room', 'dm']),
    conversationId: z.string().uuid(),
  }),
});

export const unreadUpdatedEvent = z.object({
  type: z.literal('unread.updated'),
  payload: z.object({
    conversationType: z.enum(['room', 'dm']),
    conversationId: z.string().uuid(),
    count: z.number().int().nonnegative(),
  }),
});

export const roomMemberJoinedEvent = z.object({
  type: z.literal('room.member_joined'),
  payload: z.object({ roomId: z.string().uuid(), user: userPublic }),
});

export const roomMemberLeftEvent = z.object({
  type: z.literal('room.member_left'),
  payload: z.object({ roomId: z.string().uuid(), userId: z.string().uuid() }),
});

export const roomMemberRemovedEvent = z.object({
  type: z.literal('room.member_removed'),
  payload: z.object({
    roomId: z.string().uuid(),
    userId: z.string().uuid(),
    byUserId: z.string().uuid(),
  }),
});

export const roomAccessLostEvent = z.object({
  type: z.literal('room.access_lost'),
  payload: z.object({ roomId: z.string().uuid(), reason: z.string() }),
});

export const roomDeletedEvent = z.object({
  type: z.literal('room.deleted'),
  payload: z.object({ roomId: z.string().uuid() }),
});

export const friendRequestReceivedEvent = z.object({
  type: z.literal('friend.request_received'),
  payload: z.object({
    id: z.string().uuid(),
    sender: userPublic,
    note: z.string().nullable(),
  }),
});

export const friendshipCreatedEvent = z.object({
  type: z.literal('friendship.created'),
  payload: z.object({ userId: z.string().uuid() }),
});

export const friendshipRemovedEvent = z.object({
  type: z.literal('friendship.removed'),
  payload: z.object({ userId: z.string().uuid() }),
});

export const userBanCreatedEvent = z.object({
  type: z.literal('user_ban.created'),
  payload: z.object({ bannerId: z.string().uuid(), targetId: z.string().uuid() }),
});

export const userBanRemovedEvent = z.object({
  type: z.literal('user_ban.removed'),
  payload: z.object({ bannerId: z.string().uuid(), targetId: z.string().uuid() }),
});

export const invitationReceivedEvent = z.object({
  type: z.literal('invitation.received'),
  payload: z.object({
    id: z.string().uuid(),
    roomId: z.string().uuid(),
    roomName: z.string(),
    inviter: userPublic.nullable(),
  }),
});

export type PresenceUpdateEvent = z.infer<typeof presenceUpdateEvent>;
export type MessageNewEvent = z.infer<typeof messageNewEvent>;
