import { sql } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import type { NotificationKind, NotificationSubjectType } from '@agora/shared';
import { bus } from '../bus/bus.js';
import { userTopic } from '../bus/topics.js';
import { db } from '../db/client.js';
import { userFocusRegistry } from '../ws/user-focus.js';
import { hydrateNotification } from './hydrate.js';

export interface PublishNotificationArgs {
  userId: string;
  kind: NotificationKind;
  subjectType: NotificationSubjectType | null;
  subjectId: string | null;
  actorId: string | null;
  payload: Record<string, unknown>;
}

// Only message-driven kinds should be suppressed when the user is looking at
// the conversation. Friend requests, invitations, bans etc. always deserve an
// entry in the bell regardless of current focus.
const isSuppressibleByFocus = (kind: NotificationKind): boolean =>
  kind === 'dm.new_message' || kind === 'room.mentioned';

export const publishNotification = async (
  args: PublishNotificationArgs,
): Promise<void> => {
  if (
    isSuppressibleByFocus(args.kind) &&
    args.subjectType !== null &&
    args.subjectId !== null &&
    userFocusRegistry.matches(args.userId, args.subjectType, args.subjectId)
  ) {
    return;
  }

  const newId = uuidv7();
  const payloadJson = JSON.stringify(args.payload);

  // ON CONFLICT targets the partial unique index
  // `notifications_unread_collapse_key` via inferred columns + WHERE predicate.
  // Postgres does not allow `ON CONFLICT ON CONSTRAINT` for partial indexes.
  const result = await db.execute<{ id: string }>(sql`
    INSERT INTO notifications
      (id, user_id, kind, subject_type, subject_id, actor_user_id, payload_json, aggregate_count, created_at, updated_at)
    VALUES
      (${newId}, ${args.userId}, ${args.kind}, ${args.subjectType}, ${args.subjectId}, ${args.actorId}, ${payloadJson}, 1, now(), now())
    ON CONFLICT (user_id, kind, subject_type, subject_id) WHERE read_at IS NULL DO UPDATE
      SET aggregate_count = notifications.aggregate_count + 1,
          payload_json = EXCLUDED.payload_json,
          updated_at = now()
    RETURNING id
  `);
  const resolvedId = result.rows[0]?.id ?? newId;

  const view = await hydrateNotification(resolvedId);
  if (view) {
    bus.publish(userTopic(args.userId), { type: 'notification.created', payload: view });
  }
};
