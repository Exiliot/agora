/**
 * Cascade attachment bytes on `room.deleted`.
 *
 * The in-process bus has no wildcard subscribe — handlers bind to a single
 * topic string. Room deletion events land on `room:<uuid>`, so we can't know
 * the full set of topics ahead of time without mutating the bus module.
 *
 * Rather than modifying `apps/api/src/bus/*` (ruled out for this feature), we
 * wrap `bus.publish` once at module import and intercept `room.deleted`
 * events. The wrapper still delegates to the original implementation so every
 * other subscriber keeps working — this is a pre-hook, not a replacement.
 *
 * DB cascades still depend on the rooms feature's own delete transaction
 * removing the messages; this handler only takes care of the bytes that sit
 * on the mounted volume.
 */

import { and, eq, inArray } from 'drizzle-orm';
import { bus, type BusEvent } from '../bus/bus.js';
import { db } from '../db/client.js';
import { attachments, messages } from '../db/schema.js';
import { deleteStoredFile, hashFromBuffer } from './storage.js';

interface RoomDeletedPayload {
  roomId: string;
}

const isRoomDeletedEvent = (
  event: BusEvent,
): event is BusEvent & { payload: RoomDeletedPayload } => {
  if (event.type !== 'room.deleted') return false;
  const payload = event.payload as Partial<RoomDeletedPayload> | null;
  return typeof payload?.roomId === 'string';
};

export const handleRoomDeleted = async (roomId: string): Promise<void> => {
  const messageRows = await db
    .select({ id: messages.id })
    .from(messages)
    .where(and(eq(messages.conversationType, 'room'), eq(messages.conversationId, roomId)));

  if (messageRows.length === 0) return;

  const messageIds = messageRows.map((m) => m.id);
  const attachmentRows = await db
    .select({ id: attachments.id, contentHash: attachments.contentHash })
    .from(attachments)
    .where(inArray(attachments.messageId, messageIds));

  for (const row of attachmentRows) {
    const hex = hashFromBuffer(row.contentHash);
    await deleteStoredFile(hex).catch((err) => {
      // eslint-disable-next-line no-console
      console.warn('[attachments.cascade] delete failed', { hash: hex, err });
    });
  }
};

const originalPublish = bus.publish.bind(bus);
const wrappedPublish: typeof bus.publish = (topic, event) => {
  originalPublish(topic, event);
  if (isRoomDeletedEvent(event)) {
    const { roomId } = event.payload;
    void handleRoomDeleted(roomId).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[attachments.cascade] run failed', { roomId, err });
    });
  }
};

bus.publish = wrappedPublish;
