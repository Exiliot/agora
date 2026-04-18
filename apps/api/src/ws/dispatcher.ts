/**
 * Feature-module dispatch for incoming WS events. Features register handlers
 * keyed by the event's `type` discriminator. The plugin has already parsed
 * the incoming JSON through `clientToServerEvent` (a zod discriminated union)
 * before calling `dispatchWsEvent`, so handlers receive already-validated
 * variants — no `as` casts needed.
 */

import type { ClientToServerEvent } from '@agora/shared';
import type { WsConnection } from './connection-manager.js';

export interface WsContext {
  readonly conn: WsConnection;
}

type EventType = ClientToServerEvent['type'];
type EventOf<T extends EventType> = Extract<ClientToServerEvent, { type: T }>;

type HandlerFor<T extends EventType> = (
  ctx: WsContext,
  event: EventOf<T>,
) => Promise<void> | void;

type AnyHandler = (ctx: WsContext, event: ClientToServerEvent) => Promise<void> | void;

const handlers = new Map<EventType, AnyHandler>();

export const registerWsHandler = <T extends EventType>(type: T, handler: HandlerFor<T>): void => {
  if (handlers.has(type)) {
    throw new Error(`duplicate ws handler for type: ${type}`);
  }
  handlers.set(type, handler as AnyHandler);
};

export const dispatchWsEvent = async (
  ctx: WsContext,
  event: ClientToServerEvent,
): Promise<void> => {
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
