/**
 * Cursor pagination + message view assembly. Because ids are UUIDv7 and
 * monotonic per insertion time, comparing by `id` is equivalent to comparing
 * by `(created_at, id)` but cheaper — the btree index on the PK is enough
 * once we've narrowed by (conversation_type, conversation_id).
 */

import type { MessageView } from '@agora/shared';
import { and, desc, eq, gt, inArray, lt } from 'drizzle-orm';
import { db } from '../db/client.js';
import { attachments, messages, users } from '../db/schema.js';

type ConversationType = 'room' | 'dm';

export interface HistoryQuery {
  conversationType: ConversationType;
  conversationId: string;
  /** Message id cursor — messages strictly older than this are returned. */
  before?: string;
  /** Message id cursor — messages strictly newer than this are returned. */
  since?: string;
  limit: number;
}

const toMessageView = (
  row: typeof messages.$inferSelect,
  author: { id: string; username: string } | null,
  atts: (typeof attachments.$inferSelect)[],
): MessageView => ({
  id: row.id,
  conversationType: row.conversationType,
  conversationId: row.conversationId,
  author: author ? { id: author.id, username: author.username } : null,
  body: row.body,
  replyToId: row.replyToId ?? null,
  createdAt: row.createdAt.toISOString(),
  editedAt: row.editedAt ? row.editedAt.toISOString() : null,
  deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
  attachments: atts.map((a) => ({
    id: a.id,
    size: a.size,
    mimeType: a.mimeType,
    originalFilename: a.originalFilename,
    comment: a.comment ?? null,
  })),
});

export const fetchHistory = async (q: HistoryQuery): Promise<MessageView[]> => {
  const conditions = [
    eq(messages.conversationType, q.conversationType),
    eq(messages.conversationId, q.conversationId),
  ];
  if (q.before) conditions.push(lt(messages.id, q.before));
  if (q.since) conditions.push(gt(messages.id, q.since));

  const rows = await db
    .select()
    .from(messages)
    .where(and(...conditions))
    .orderBy(desc(messages.createdAt), desc(messages.id))
    .limit(q.limit);

  return hydrateMessages(rows);
};

export const hydrateMessages = async (
  rows: (typeof messages.$inferSelect)[],
): Promise<MessageView[]> => {
  if (rows.length === 0) return [];

  const authorIds = Array.from(
    new Set(rows.map((r) => r.authorId).filter((id): id is string => id !== null)),
  );
  const messageIds = rows.map((r) => r.id);

  const authorRows = authorIds.length
    ? await db
        .select({ id: users.id, username: users.username })
        .from(users)
        .where(inArray(users.id, authorIds))
    : [];
  const authorsById = new Map(authorRows.map((u) => [u.id, u]));

  const attachmentRows = await db
    .select()
    .from(attachments)
    .where(inArray(attachments.messageId, messageIds));
  const attachmentsByMessage = new Map<string, (typeof attachments.$inferSelect)[]>();
  for (const a of attachmentRows) {
    if (!a.messageId) continue;
    const list = attachmentsByMessage.get(a.messageId) ?? [];
    list.push(a);
    attachmentsByMessage.set(a.messageId, list);
  }

  return rows.map((row) =>
    toMessageView(
      row,
      row.authorId ? (authorsById.get(row.authorId) ?? null) : null,
      attachmentsByMessage.get(row.id) ?? [],
    ),
  );
};

export const hydrateMessage = async (
  row: typeof messages.$inferSelect,
): Promise<MessageView> => {
  const [view] = await hydrateMessages([row]);
  if (!view) throw new Error('hydrateMessage: row vanished');
  return view;
};
