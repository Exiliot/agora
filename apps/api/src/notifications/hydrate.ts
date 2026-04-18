import { eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type {
  NotificationKind,
  NotificationSubjectType,
  NotificationView,
} from '@agora/shared';
import { db } from '../db/client.js';
import { notifications, users } from '../db/schema.js';

const actor = alias(users, 'actor');

export const hydrateNotification = async (id: string): Promise<NotificationView | null> => {
  const rows = await db
    .select({
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
    })
    .from(notifications)
    .leftJoin(actor, eq(actor.id, notifications.actorUserId))
    .where(eq(notifications.id, id))
    .limit(1);
  const r = rows[0];
  if (!r) return null;

  let parsedPayload: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(r.payloadJson);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      parsedPayload = parsed as Record<string, unknown>;
    }
  } catch {
    // Malformed JSON – publisher writes with JSON.stringify, so this is defensive.
    parsedPayload = {};
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
    payload: parsedPayload,
    aggregateCount: r.aggregateCount,
    readAt: r.readAt ? r.readAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
};
