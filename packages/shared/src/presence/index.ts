import { z } from 'zod';

export const presenceState = z.enum(['online', 'afk', 'offline']);
export type PresenceState = z.infer<typeof presenceState>;

export const presenceEntry = z.object({
  userId: z.string().uuid(),
  state: presenceState,
});
export type PresenceEntry = z.infer<typeof presenceEntry>;
