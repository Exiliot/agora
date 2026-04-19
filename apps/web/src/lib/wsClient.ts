/**
 * Reconnecting WebSocket client with simple pub/sub semantics.
 *
 *   const client = createWsClient();
 *   client.connect();
 *   const off = client.on('message.new', (event) => { ... });
 *   const ack = await client.request('message.send', payload);
 *
 * The server echoes incoming events with reqId so we can correlate acks.
 * Reconnect uses exponential backoff capped at 30s.
 */

import type { ServerToClientEvent, ServerToClientEventType } from '@agora/shared';
import { generateTabId } from './tabId';

interface ServerEvent {
  type: string;
  payload?: unknown;
}

type EventHandler = (event: ServerEvent) => void;

// Synthetic client-side events: emitted by the WS client itself on
// (re)connection so subscribers can backfill, not on the wire.
type SyntheticEventType = 'ws.open' | 'ws.reopen';

type TypedHandler<T extends ServerToClientEventType> = (
  event: Extract<ServerToClientEvent, { type: T }>,
) => void;

interface PendingRequest {
  resolve: (result: unknown) => void;
  reject: (err: Error) => void;
}

export interface WsClient {
  connect(): void;
  close(): void;
  on<T extends ServerToClientEventType>(type: T, handler: TypedHandler<T>): () => void;
  on(type: SyntheticEventType, handler: (event: ServerEvent) => void): () => void;
  request<T = unknown>(type: string, payload: unknown): Promise<T>;
  send(event: { type: string; payload?: unknown }): void;
  readonly state: 'idle' | 'connecting' | 'open' | 'closed' | 'reconnecting';
}

const RECONNECT_MAX_MS = 30_000;
const HEARTBEAT_THROTTLE_MS = 5_000;

export const createWsClient = (): WsClient => {
  let socket: WebSocket | null = null;
  let state: WsClient['state'] = 'idle';
  let hasConnectedBefore = false;
  let intentionallyClosed = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  const handlers = new Map<string, Set<EventHandler>>();
  const pending = new Map<string, PendingRequest>();
  let backoffMs = 1_000;
  let openConversationIds: string[] = [];
  let lastHeartbeatAt = 0;

  const scheduleReconnect = () => {
    if (intentionallyClosed || reconnectTimer) return;
    // Jitter 0.5–1.5× the backoff so a mass-reconnect after a server restart
    // doesn't produce synchronised retries from every client.
    const delay = Math.round(backoffMs * (0.5 + Math.random()));
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      openSocket();
    }, delay);
    backoffMs = Math.min(RECONNECT_MAX_MS, backoffMs * 2);
  };

  const dispatch = (event: ServerEvent, reqId?: string) => {
    if (reqId) {
      const p = pending.get(reqId);
      if (p) {
        pending.delete(reqId);
        if (event.type === 'ack') {
          const result = (event.payload as { result?: unknown } | undefined)?.result;
          p.resolve(result);
        } else if (event.type === 'err') {
          const err = event.payload as { message?: string; code?: string } | undefined;
          const base = err?.message ?? 'ws error';
          const withCode = err?.code ? `${base} (${err.code})` : base;
          p.reject(new Error(withCode));
        }
        return;
      }
    }
    const subs = handlers.get(event.type);
    if (!subs) return;
    for (const handler of subs) {
      try {
        handler(event);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[ws] handler threw', err);
      }
    }
  };

  const openSocket = () => {
    if (state === 'connecting' || state === 'open') return;
    state = state === 'idle' ? 'connecting' : 'reconnecting';
    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${scheme}://${window.location.host}/ws`;
    const ws = new WebSocket(url);
    socket = ws;

    ws.onopen = () => {
      state = 'open';
      backoffMs = 1_000;
      const reqId = `r_${crypto.randomUUID()}`;
      ws.send(
        JSON.stringify({
          type: 'hello',
          reqId,
          payload: { tabId: generateTabId(), openConversationIds },
        }),
      );
      // Synthesise a local event so subscribers can backfill on reconnect.
      dispatch({ type: hasConnectedBefore ? 'ws.reopen' : 'ws.open' });
      hasConnectedBefore = true;
    };

    ws.onmessage = (message) => {
      try {
        const parsed = JSON.parse(message.data as string) as ServerEvent & { reqId?: string };
        const reqId = (parsed.payload as { reqId?: string } | undefined)?.reqId ?? parsed.reqId;
        dispatch(parsed, reqId);
      } catch {
        // ignore bad frames
      }
    };

    ws.onclose = () => {
      socket = null;
      state = 'closed';
      for (const p of pending.values()) p.reject(new Error('ws closed'));
      pending.clear();
      scheduleReconnect();
    };

    ws.onerror = () => {
      ws.close();
    };
  };

  // Implementation of the typed overloads declared on WsClient. We widen
  // to (string, EventHandler) at the call site and rely on the overloads
  // to keep external callers honest.
  const onImpl = (type: string, handler: EventHandler): (() => void) => {
    const set = handlers.get(type) ?? new Set<EventHandler>();
    set.add(handler);
    handlers.set(type, set);
    return () => {
      set.delete(handler);
      if (set.size === 0) handlers.delete(type);
    };
  };

  return {
    connect() {
      openSocket();
    },
    close() {
      intentionallyClosed = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
      state = 'closed';
    },
    on: onImpl as WsClient['on'],
    send(event) {
      if (event.type === 'heartbeat') {
        const now = Date.now();
        if (now - lastHeartbeatAt < HEARTBEAT_THROTTLE_MS) return;
        lastHeartbeatAt = now;
      }
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(event));
      }
    },
    request<T>(type: string, payload: unknown): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        if (!socket || socket.readyState !== WebSocket.OPEN) {
          reject(new Error('ws not open'));
          return;
        }
        const reqId = `r_${crypto.randomUUID()}`;
        pending.set(reqId, {
          resolve: (r) => resolve(r as T),
          reject,
        });
        socket.send(JSON.stringify({ type, reqId, payload }));
        setTimeout(() => {
          if (pending.has(reqId)) {
            pending.delete(reqId);
            reject(new Error('ws request timed out'));
          }
        }, 10_000);
      });
    },
    get state() {
      return state;
    },
  };
};

export const wsClient: WsClient = createWsClient();
