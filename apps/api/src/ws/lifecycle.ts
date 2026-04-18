/**
 * Tiny extension point so feature modules can react to WS lifecycle events
 * (hello with a tabId attached, socket close) without touching `plugin.ts`.
 *
 * Handlers are synchronous and must not throw — the plugin calls `emit` on
 * the hot path after assigning `conn.tabId`.
 */

import type { WsConnection } from './connection-manager.js';

type LifecycleEvent = 'hello' | 'close';
type Listener = (conn: WsConnection) => void;

const listeners = new Map<LifecycleEvent, Set<Listener>>();

const getSet = (event: LifecycleEvent): Set<Listener> => {
  const existing = listeners.get(event);
  if (existing) return existing;
  const set = new Set<Listener>();
  listeners.set(event, set);
  return set;
};

export const connectionLifecycle = {
  on(event: LifecycleEvent, listener: Listener): () => void {
    const set = getSet(event);
    set.add(listener);
    return () => set.delete(listener);
  },
  emit(event: LifecycleEvent, conn: WsConnection): void {
    const set = listeners.get(event);
    if (!set) return;
    for (const listener of set) {
      try {
        listener(conn);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[ws/lifecycle] listener threw', { event, err });
      }
    }
  },
};
