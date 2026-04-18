/**
 * Per-conversation "highest message id I've seen" watermark. Persists to
 * `sessionStorage` so a tab refresh doesn't lose the cursor mid-session.
 * On WS reconnect we backfill with `/messages?since=<cursor>`.
 */

import { create } from 'zustand';

type Key = string; // `${conversationType}:${conversationId}`

const key = (type: string, id: string): Key => `${type}:${id}`;

const STORAGE_KEY = 'agora.lastSeen.v1';

const loadFromStorage = (): Record<Key, string> => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<Key, string>;
  } catch {
    return {};
  }
};

const saveToStorage = (state: Record<Key, string>): void => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // sessionStorage may be disabled; non-fatal.
  }
};

interface LastSeenState {
  marks: Record<Key, string>;
  note: (type: string, id: string, messageId: string) => void;
  get: (type: string, id: string) => string | null;
  entries: () => { type: string; id: string; messageId: string }[];
}

export const useLastSeenStore = create<LastSeenState>((set, getState) => ({
  marks: loadFromStorage(),
  note: (type, id, messageId) => {
    const k = key(type, id);
    const current = getState().marks[k];
    // UUIDv7 is k-sortable lexically — only advance, never regress.
    if (current && current >= messageId) return;
    set((prev) => {
      const next = { ...prev.marks, [k]: messageId };
      saveToStorage(next);
      return { marks: next };
    });
  },
  get: (type, id) => getState().marks[key(type, id)] ?? null,
  entries: () =>
    Object.entries(getState().marks).map(([k, messageId]) => {
      const colon = k.indexOf(':');
      const type = k.slice(0, colon);
      const id = k.slice(colon + 1);
      return { type, id, messageId };
    }),
}));
