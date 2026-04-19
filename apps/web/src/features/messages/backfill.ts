/**
 * On WebSocket reconnect, fetch `?since=<lastSeenId>` for each conversation
 * we have a watermark for, and merge the results into the React Query cache
 * at the head of the first page. This closes the gap described in the
 * organiser's "watermark" hint.
 */

import type { QueryClient } from '@tanstack/react-query';
import type { MessageView } from '@agora/shared';
import { api } from '../../lib/apiClient';
import { useLastSeenStore } from './lastSeen';

const MAX_BATCH = 500; // matches api's MAX_SINCE_LIMIT

export const backfillAllConversations = async (qc: QueryClient): Promise<void> => {
  const entries = useLastSeenStore.getState().entries();
  if (entries.length === 0) return;

  const note = useLastSeenStore.getState().note;

  await Promise.all(
    entries.map(async (entry) => {
      try {
        const url = `/conversations/${entry.type}/${entry.id}/messages?since=${entry.messageId}&limit=${MAX_BATCH}`;
        const response = await api.get<{ messages: MessageView[] }>(url);
        const incoming = response.messages ?? [];
        if (incoming.length === 0) return;

        // Advance the watermark to the latest incoming id. The backend
        // returns `created_at DESC`, so the newest row is at index 0 – not
        // at the tail. L19: using the tail element pinned the watermark to
        // the oldest of the batch and caused the next reconnect to re-fetch
        // messages we already have in cache.
        const latest = incoming[0];
        if (latest) note(entry.type, entry.id, latest.id);

        if (incoming.length >= MAX_BATCH) {
          // Gap may exceed our single-shot limit; invalidate so the infinite
          // query refetches from scratch and surfaces the catch-up properly.
          qc.invalidateQueries({ queryKey: ['messages', entry.type, entry.id] });
          return;
        }

        // Otherwise merge the new messages into the first page of the infinite
        // query's cache. The backend returns in `created_at DESC` order.
        qc.setQueryData<{
          pages: { messages: MessageView[]; hasMore: boolean }[];
          pageParams: unknown[];
        }>(['messages', entry.type, entry.id], (old) => {
          if (!old) return old;
          const firstPage = old.pages[0];
          if (!firstPage) return old;
          const known = new Set(firstPage.messages.map((m) => m.id));
          const fresh = incoming.filter((m) => !known.has(m.id));
          if (fresh.length === 0) return old;
          const merged = {
            ...firstPage,
            messages: [...fresh, ...firstPage.messages],
          };
          return {
            ...old,
            pages: [merged, ...old.pages.slice(1)],
          };
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[backfill] failed for', entry, err);
      }
    }),
  );
};
