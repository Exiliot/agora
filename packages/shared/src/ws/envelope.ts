import { z } from 'zod';

export const reqIdSchema = z.string().min(1).max(64);

export const ackEnvelope = z.object({
  type: z.literal('ack'),
  reqId: reqIdSchema,
  result: z.unknown().optional(),
});

export const errEnvelope = z.object({
  type: z.literal('err'),
  reqId: reqIdSchema.optional(),
  code: z.string(),
  message: z.string(),
});

export type AckEnvelope = z.infer<typeof ackEnvelope>;
export type ErrEnvelope = z.infer<typeof errEnvelope>;
