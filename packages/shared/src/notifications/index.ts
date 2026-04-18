import { z } from 'zod';
import { userPublic } from '../users/index.js';

export const unreadCount = z.object({
  conversationType: z.enum(['room', 'dm']),
  conversationId: z.string().uuid(),
  count: z.number().int().nonnegative(),
});
export type UnreadCount = z.infer<typeof unreadCount>;

export const notificationKind = z.enum([
  'dm.new_message',
  'room.mentioned',
  'friend.request',
  'friend.accepted',
  'room.invitation',
  'room.role_changed',
  'room.removed',
  'room.deleted',
  'room.ban',
  'user.ban',
  'room.joined_private',
  'session.revoked_elsewhere',
]);
export type NotificationKind = z.infer<typeof notificationKind>;

export const notificationSubjectType = z.enum(['room', 'dm', 'user']);
export type NotificationSubjectType = z.infer<typeof notificationSubjectType>;

export const notificationView = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  kind: notificationKind,
  subjectType: notificationSubjectType.nullable(),
  subjectId: z.string().uuid().nullable(),
  actor: userPublic.nullable(),
  payload: z.record(z.unknown()),
  aggregateCount: z.number().int().positive(),
  readAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type NotificationView = z.infer<typeof notificationView>;

export const clientFocusEvent = z.object({
  type: z.literal('client.focus'),
  payload: z.object({
    subjectType: notificationSubjectType.nullable(),
    subjectId: z.string().uuid().nullable(),
  }),
});
export type ClientFocusEvent = z.infer<typeof clientFocusEvent>;

export const notificationCreatedEvent = z.object({
  type: z.literal('notification.created'),
  payload: notificationView,
});
export type NotificationCreatedEvent = z.infer<typeof notificationCreatedEvent>;

export const notificationReadEvent = z.object({
  type: z.literal('notification.read'),
  payload: z.object({ id: z.string().uuid() }),
});
export type NotificationReadEvent = z.infer<typeof notificationReadEvent>;

export const notificationReadAllEvent = z.object({
  type: z.literal('notification.read_all'),
  payload: z.object({}).default({}),
});
export type NotificationReadAllEvent = z.infer<typeof notificationReadAllEvent>;
