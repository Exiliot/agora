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

const YIELD_EVERY = 100;

const dispatchOne = (
  handler: Handler,
  event: BusEvent,
  serialised: string | undefined,
  topic: string,
): void => {
  try {
    handler(event, serialised);
  } catch (err) {
    // Log but do not rethrow — one bad subscriber must not kill fan-out.
    // eslint-disable-next-line no-console
    console.error('[bus] handler threw', { topic, type: event.type, err });
  }
};

const dispatchBatched = async (
  snapshot: Handler[],
  event: BusEvent,
  serialised: string | undefined,
  topic: string,
): Promise<void> => {
  for (let i = 0; i < snapshot.length; i += YIELD_EVERY) {
    const batch = snapshot.slice(i, i + YIELD_EVERY);
    for (const handler of batch) {
      const h = handler;
      dispatchOne(h, event, serialised, topic);
    }
    // Yield to let other I/O (incoming WS frames, HTTP requests) interleave
    // between batches so 1000-member fan-out doesn't stall the event loop.
    if (i + YIELD_EVERY < snapshot.length) {
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
  }
};

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
      // Snapshot the handler set so mutations during dispatch (an unsubscribe
      // fired from a handler) don't skip siblings. Iterate synchronously for
      // the common case; yield every YIELD_EVERY handlers to keep the event
      // loop responsive when fanning out to large rooms (NFR-CAP-2 = 1000).
      const snapshot = Array.from(handlers);
      if (snapshot.length <= YIELD_EVERY) {
        for (const handler of snapshot) dispatchOne(handler, event, serialised, topic);
        return;
      }
      void dispatchBatched(snapshot, event, serialised, topic);
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
