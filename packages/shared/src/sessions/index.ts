import { z } from 'zod';

export const sessionView = z.object({
  id: z.string().uuid(),
  userAgent: z.string().nullable(),
  ip: z.string().nullable(),
  createdAt: z.string(),
  lastSeenAt: z.string(),
  expiresAt: z.string(),
  isCurrent: z.boolean(),
});
export type SessionView = z.infer<typeof sessionView>;
