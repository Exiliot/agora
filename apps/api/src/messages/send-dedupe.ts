/**
 * Client-keyed idempotency for message.send. A short TTL LRU prevents an
 * insert when the same (authorId, clientMessageId) was just handled; the
 * partial unique index on (author_id, client_message_id) is the DB-level
 * backstop. See ADR-0006.
 */

interface CacheEntry {
  messageId: string;
  expiresAt: number;
}

const TTL_MS = 60_000;
const MAX_ENTRIES = 1000;

const cache = new Map<string, CacheEntry>();

const key = (authorId: string, clientMessageId: string): string =>
  `${authorId}:${clientMessageId}`;

const evictExpired = (): void => {
  const now = Date.now();
  for (const [k, v] of cache) {
    if (v.expiresAt <= now) cache.delete(k);
  }
};

const evictOldest = (): void => {
  if (cache.size <= MAX_ENTRIES) return;
  // Map iteration order is insertion order.
  const overflow = cache.size - MAX_ENTRIES;
  let i = 0;
  for (const k of cache.keys()) {
    if (i++ >= overflow) break;
    cache.delete(k);
  }
};

export const lookupDedupe = (
  authorId: string,
  clientMessageId: string,
): string | undefined => {
  const e = cache.get(key(authorId, clientMessageId));
  if (!e) return undefined;
  if (e.expiresAt <= Date.now()) {
    cache.delete(key(authorId, clientMessageId));
    return undefined;
  }
  return e.messageId;
};

export const rememberDedupe = (
  authorId: string,
  clientMessageId: string,
  messageId: string,
): void => {
  evictExpired();
  cache.set(key(authorId, clientMessageId), {
    messageId,
    expiresAt: Date.now() + TTL_MS,
  });
  evictOldest();
};

// Test-only.
export const _resetDedupe = (): void => {
  cache.clear();
};
