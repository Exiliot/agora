import { z } from 'zod';
import { reqIdSchema } from './envelope.js';

// --- client → server events ---------------------------------------------------

export const helloEvent = z.object({
  type: z.literal('hello'),
  reqId: reqIdSchema,
  payload: z.object({
    tabId: z.string().min(8).max(64),
    openConversationIds: z.array(z.string().uuid()).default([]),
  }),
});

export const heartbeatEvent = z.object({
  type: z.literal('heartbeat'),
  payload: z.object({}).default({}),
});

export const echoEvent = z.object({
  type: z.literal('echo'),
  reqId: reqIdSchema,
  payload: z.object({
    text: z.string().max(4096),
  }),
});

export const clientToServerEvent = z.discriminatedUnion('type', [
  helloEvent,
  heartbeatEvent,
  echoEvent,
]);

// --- server → client events ---------------------------------------------------

export const presenceState = z.enum(['online', 'afk', 'offline']);

export const presenceUpdateEvent = z.object({
  type: z.literal('presence.update'),
  payload: z.object({
    userId: z.string().uuid(),
    state: presenceState,
  }),
});

export const serverBannerEvent = z.object({
  type: z.literal('server.banner'),
  payload: z.object({
    level: z.enum(['info', 'warn', 'error']),
    text: z.string(),
  }),
});

export type HelloEvent = z.infer<typeof helloEvent>;
export type HeartbeatEvent = z.infer<typeof heartbeatEvent>;
export type EchoEvent = z.infer<typeof echoEvent>;
export type ClientToServerEvent = z.infer<typeof clientToServerEvent>;
export type PresenceState = z.infer<typeof presenceState>;
export type PresenceUpdateEvent = z.infer<typeof presenceUpdateEvent>;
