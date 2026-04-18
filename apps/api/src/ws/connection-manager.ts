/**
 * Per-WebSocket state: user identity, tab id, active subscriptions.
 *
 * The manager owns bookkeeping; features subscribe connections to topics
 * via `subscribe(conn, topic)` and unsubscribe on leave.
 */

import type { WebSocket } from 'ws';
import { bus, type BusEvent } from '../bus/bus.js';

export interface WsConnection {
  readonly id: string;
  readonly userId: string;
  readonly socket: WebSocket;
  tabId: string | null;
  readonly subscriptions: Map<string, () => void>;
  send(event: BusEvent): void;
  /** Send a pre-serialised JSON frame — used by bus fan-out to skip a per-connection stringify. */
  sendRaw(serialised: string, type: string): void;
  closeWith(code: number, reason?: string): void;
}

const MAX_OUTBOUND_QUEUE = 512;

export const createConnection = (args: {
  id: string;
  userId: string;
  socket: WebSocket;
}): WsConnection => {
  const subscriptions = new Map<string, () => void>();
  let queued = 0;

  const writeFrame = (serialised: string, type: string) => {
    // Bounded outbound queue — drop presence updates under pressure, never drop
    // messages (see docs/ws-protocol.md §6).
    if (queued >= MAX_OUTBOUND_QUEUE && type === 'presence.update') return;
    queued += 1;
    args.socket.send(serialised, (err) => {
      queued = Math.max(0, queued - 1);
      if (err) {
        // eslint-disable-next-line no-console
        console.warn('[ws] send failed', { connId: args.id, err: err.message });
      }
    });
  };

  const send = (event: BusEvent): void => {
    writeFrame(JSON.stringify(event), event.type);
  };

  const sendRaw = (serialised: string, type: string): void => {
    writeFrame(serialised, type);
  };

  const closeWith = (code: number, reason?: string): void => {
    try {
      args.socket.close(code, reason);
    } catch {
      // ignore
    }
  };

  return {
    id: args.id,
    userId: args.userId,
    socket: args.socket,
    tabId: null,
    subscriptions,
    send,
    sendRaw,
    closeWith,
  };
};

export const subscribeConnection = (conn: WsConnection, topic: string): void => {
  if (conn.subscriptions.has(topic)) return;
  const unsubscribe = bus.subscribe(topic, (event, serialised) => {
    if (serialised) {
      conn.sendRaw(serialised, event.type);
    } else {
      conn.send(event);
    }
  });
  conn.subscriptions.set(topic, unsubscribe);
};

export const unsubscribeConnection = (conn: WsConnection, topic: string): void => {
  const off = conn.subscriptions.get(topic);
  if (off) off();
  conn.subscriptions.delete(topic);
};

export const unsubscribeAll = (conn: WsConnection): void => {
  for (const off of conn.subscriptions.values()) off();
  conn.subscriptions.clear();
};

/**
 * Registry of live connections. Used by features that need to push to a user
 * directly (e.g. same-user multi-tab state sync).
 */
class ConnectionRegistry {
  private byId = new Map<string, WsConnection>();
  private byUser = new Map<string, Set<WsConnection>>();

  add(conn: WsConnection): void {
    this.byId.set(conn.id, conn);
    const forUser = this.byUser.get(conn.userId) ?? new Set<WsConnection>();
    forUser.add(conn);
    this.byUser.set(conn.userId, forUser);
  }

  remove(conn: WsConnection): void {
    this.byId.delete(conn.id);
    const forUser = this.byUser.get(conn.userId);
    if (!forUser) return;
    forUser.delete(conn);
    if (forUser.size === 0) this.byUser.delete(conn.userId);
  }

  forUser(userId: string): WsConnection[] {
    return Array.from(this.byUser.get(userId) ?? []);
  }

  all(): WsConnection[] {
    return Array.from(this.byId.values());
  }

  size(): number {
    return this.byId.size;
  }
}

export const connections = new ConnectionRegistry();
