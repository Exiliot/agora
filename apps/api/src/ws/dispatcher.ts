/**
 * Feature-module dispatch for incoming WS events. Features register handlers
 * on the dispatcher; the ws plugin routes each incoming event to the matching
 * handler. This keeps feature modules decoupled from the WS plumbing.
 */

import type { WsConnection } from './connection-manager.js';

export interface WsContext {
  readonly conn: WsConnection;
}

export type WsHandler = (ctx: WsContext, event: unknown) => Promise<void> | void;

const handlers = new Map<string, WsHandler>();

export const registerWsHandler = (type: string, handler: WsHandler): void => {
  if (handlers.has(type)) {
    throw new Error(`duplicate ws handler for type: ${type}`);
  }
  handlers.set(type, handler);
};

export const dispatchWsEvent = async (ctx: WsContext, event: { type: string }): Promise<void> => {
  const handler = handlers.get(event.type);
  if (!handler) {
    ctx.conn.send({
      type: 'err',
      payload: { code: 'unknown_event', message: `no handler for ${event.type}` },
    });
    return;
  }
  await handler(ctx, event);
};

export const knownWsEvents = (): string[] => Array.from(handlers.keys()).sort();
