/**
 * In-process pub/sub bus (ADR-0002).
 *
 * Handlers are notified synchronously in the order they subscribed. Handler
 * exceptions are caught and logged; they do not affect other subscribers.
 *
 * Publish pre-serialises the event once and passes both the object and the
 * JSON string to every handler. WS subscribers can `ws.send(serialised)`
 * directly and skip a per-connection JSON.stringify — matters in large rooms
 * where a single message fans out to hundreds of sockets.
 */

export type BusEvent = {
  readonly type: string;
  readonly payload: unknown;
};

type Handler = (event: BusEvent, serialised?: string) => void;

export interface Bus {
  publish(topic: string, event: BusEvent): void;
  subscribe(topic: string, handler: Handler): () => void;
  listTopics(): string[];
  countSubscribers(topic: string): number;
}

const createInMemoryBus = (): Bus => {
  const table = new Map<string, Set<Handler>>();

  return {
    publish(topic, event) {
      const handlers = table.get(topic);
      if (!handlers || handlers.size === 0) return;
      // Pre-stringify once if there's more than one subscriber so individual
      // handlers can reuse the serialised payload. Single-subscriber topics
      // skip the serialisation — the handler may not need it.
      const serialised = handlers.size > 1 ? JSON.stringify(event) : undefined;
      for (const handler of handlers) {
        try {
          handler(event, serialised);
        } catch (err) {
          // Log but do not rethrow — one bad subscriber must not kill fan-out.
          // eslint-disable-next-line no-console
          console.error('[bus] handler threw', { topic, type: event.type, err });
        }
      }
    },

    subscribe(topic, handler) {
      const existing = table.get(topic) ?? new Set<Handler>();
      existing.add(handler);
      table.set(topic, existing);
      return () => {
        const handlers = table.get(topic);
        if (!handlers) return;
        handlers.delete(handler);
        if (handlers.size === 0) table.delete(topic);
      };
    },

    listTopics() {
      return Array.from(table.keys());
    },

    countSubscribers(topic) {
      return table.get(topic)?.size ?? 0;
    },
  };
};

export const bus: Bus = createInMemoryBus();
