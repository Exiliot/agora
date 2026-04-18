/**
 * Periodic sweep for orphan attachments: rows whose `message_id` is still null
 * more than an hour after upload. Runs every 15 minutes by default, importing
 * this module schedules the interval. The first tick fires after one interval
 * so boot stays quiet.
 *
 * The sweep is conservative: it deletes the DB row first, then the bytes on
 * disk. If another live attachment row still references the same content hash
 * (dedupe), the file is kept.
 */

import { and, eq, isNull, lt, ne } from 'drizzle-orm';
import { db } from '../db/client.js';
import { attachments } from '../db/schema.js';
import { deleteStoredFile, hashFromBuffer } from './storage.js';

export const ORPHAN_AGE_MS = 60 * 60 * 1000;
export const ORPHAN_SWEEP_INTERVAL_MS = 15 * 60 * 1000;

export const sweepOrphans = async (now: Date = new Date()): Promise<number> => {
  const cutoff = new Date(now.getTime() - ORPHAN_AGE_MS);

  const orphans = await db
    .select({
      id: attachments.id,
      contentHash: attachments.contentHash,
    })
    .from(attachments)
    .where(and(isNull(attachments.messageId), lt(attachments.createdAt, cutoff)));

  if (orphans.length === 0) return 0;

  for (const orphan of orphans) {
    await db.delete(attachments).where(eq(attachments.id, orphan.id));

    const stillReferenced = await db
      .select({ id: attachments.id })
      .from(attachments)
      .where(
        and(eq(attachments.contentHash, orphan.contentHash), ne(attachments.id, orphan.id)),
      )
      .limit(1);
    if (stillReferenced.length > 0) continue;

    const hex = hashFromBuffer(orphan.contentHash);
    await deleteStoredFile(hex).catch((err) => {
      // eslint-disable-next-line no-console
      console.warn('[attachments.sweeper] delete failed', { hash: hex, err });
    });
  }

  return orphans.length;
};

const schedule = (): NodeJS.Timeout => {
  const timer = setInterval(() => {
    void sweepOrphans().catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[attachments.sweeper] run failed', err);
    });
  }, ORPHAN_SWEEP_INTERVAL_MS);
  timer.unref();
  return timer;
};

// Non-destructive under `NODE_ENV=test`: tests import `sweepOrphans` directly
// and don't want a background timer ticking in parallel.
if (process.env['NODE_ENV'] !== 'test') {
  schedule();
}
