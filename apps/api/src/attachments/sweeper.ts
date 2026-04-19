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

import { and, inArray, isNull, lt } from 'drizzle-orm';
import { db } from '../db/client.js';
import { attachments } from '../db/schema.js';
import { deleteStoredFile } from './storage.js';

export const ORPHAN_AGE_MS = 60 * 60 * 1000;
export const ORPHAN_SWEEP_INTERVAL_MS = 15 * 60 * 1000;

export const sweepOrphans = async (now: Date = new Date()): Promise<number> => {
  const cutoff = new Date(now.getTime() - ORPHAN_AGE_MS);

  // M11: batched sweep. Previously this deleted one row at a time and ran a
  // per-row "still referenced?" probe, so 1000 orphans meant 2000 RTT. Now:
  //   (1) one DELETE … RETURNING collects every orphan row in one shot,
  //   (2) one SELECT checks which of those hashes still survive elsewhere,
  //   (3) hashes that don't survive get one fs unlink each.
  const deleted = await db
    .delete(attachments)
    .where(and(isNull(attachments.messageId), lt(attachments.createdAt, cutoff)))
    .returning({ id: attachments.id, contentHash: attachments.contentHash });

  if (deleted.length === 0) return 0;

  const uniqueHashes = new Map<string, Buffer>();
  for (const row of deleted) {
    const key = row.contentHash.toString('hex');
    if (!uniqueHashes.has(key)) uniqueHashes.set(key, row.contentHash);
  }

  const stillRef = uniqueHashes.size
    ? await db
        .select({ contentHash: attachments.contentHash })
        .from(attachments)
        .where(inArray(attachments.contentHash, Array.from(uniqueHashes.values())))
    : [];
  const stillRefHex = new Set(stillRef.map((r) => r.contentHash.toString('hex')));

  await Promise.all(
    Array.from(uniqueHashes.keys()).map(async (hex) => {
      if (stillRefHex.has(hex)) return;
      await deleteStoredFile(hex).catch((err) => {
        // eslint-disable-next-line no-console
        console.warn('[attachments.sweeper] delete failed', { hash: hex, err });
      });
    }),
  );

  return deleted.length;
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
