import { eq, inArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type {
  NotificationKind,
  NotificationSubjectType,
  NotificationView,
} from '@agora/shared';
import { db } from '../db/client.js';
import { notifications, users } from '../db/schema.js';

export const actor = alias(users, 'actor');

export interface HydrateRow {
  id: string;
  userId: string;
  kind: string;
  subjectType: string | null;
  subjectId: string | null;
  actorId: string | null;
  actorUsername: string | null;
  payloadJson: string;
  aggregateCount: number;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export const rowToView = (r: HydrateRow): NotificationView => {
  let payload: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(r.payloadJson);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      payload = parsed as Record<string, unknown>;
    }
  } catch {
    // Malformed JSON – publisher writes with JSON.stringify, so this is defensive.
    payload = {};
  }
  return {
    id: r.id,
    userId: r.userId,
    kind: r.kind as NotificationKind,
    subjectType: (r.subjectType as NotificationSubjectType | null) ?? null,
    subjectId: r.subjectId ?? null,
    actor:
      r.actorId && r.actorUsername
        ? { id: r.actorId, username: r.actorUsername }
        : null,
    payload,
    aggregateCount: r.aggregateCount,
    readAt: r.readAt ? r.readAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
};

export const hydrateSelection = {
  id: notifications.id,
  userId: notifications.userId,
  kind: notifications.kind,
  subjectType: notifications.subjectType,
  subjectId: notifications.subjectId,
  actorId: actor.id,
  actorUsername: actor.username,
  payloadJson: notifications.payloadJson,
  aggregateCount: notifications.aggregateCount,
  readAt: notifications.readAt,
  createdAt: notifications.createdAt,
  updatedAt: notifications.updatedAt,
} as const;

export const hydrateNotifications = async (
  ids: string[],
): Promise<NotificationView[]> => {
  if (ids.length === 0) return [];
  const rows = await db
    .select(hydrateSelection)
    .from(notifications)
    .leftJoin(actor, eq(actor.id, notifications.actorUserId))
    .where(inArray(notifications.id, ids));
  const byId = new Map(rows.map((r) => [r.id, rowToView(r)] as const));
  return ids
    .map((id) => byId.get(id))
    .filter((v): v is NotificationView => Boolean(v));
};

export const hydrateNotification = async (
  id: string,
): Promise<NotificationView | null> => {
  const [view] = await hydrateNotifications([id]);
  return view ?? null;
};
