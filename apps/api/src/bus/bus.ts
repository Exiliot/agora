/**
 * In-process pub/sub bus (ADR-0002).
 *
 * Handlers are notified synchronously in the order they subscribed. Handler
 * exceptions are caught and logged; they do not affect other subscribers.
 */

export type BusEvent = {
  readonly type: string;
  readonly payload: unknown;
};

type Handler = (event: BusEvent) => void;

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
      for (const handler of handlers) {
        try {
          handler(event);
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
