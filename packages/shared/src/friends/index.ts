import { z } from 'zod';
import { userPublic, usernameSchema } from '../users/index.js';

export const friendRequestCreate = z.object({
  targetUsername: usernameSchema,
  note: z.string().max(280).optional(),
});
export type FriendRequestCreate = z.infer<typeof friendRequestCreate>;

export const friendRequestView = z.object({
  id: z.string().uuid(),
  sender: userPublic,
  recipient: userPublic,
  note: z.string().nullable(),
  createdAt: z.string(),
});
export type FriendRequestView = z.infer<typeof friendRequestView>;

export const friendshipView = z.object({
  user: userPublic,
  establishedAt: z.string(),
});
export type FriendshipView = z.infer<typeof friendshipView>;

export const userBanCreate = z.object({
  targetUserId: z.string().uuid(),
  reason: z.string().max(280).optional(),
});
export type UserBanCreate = z.infer<typeof userBanCreate>;
