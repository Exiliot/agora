import { z } from 'zod';

export const unreadCount = z.object({
  conversationType: z.enum(['room', 'dm']),
  conversationId: z.string().uuid(),
  count: z.number().int().nonnegative(),
});
export type UnreadCount = z.infer<typeof unreadCount>;
