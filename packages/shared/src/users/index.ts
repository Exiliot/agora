import { z } from 'zod';

export const usernameSchema = z
  .string()
  .min(3)
  .max(32)
  .regex(/^[a-z][a-z0-9._-]*$/, 'username must be lowercase, start with a letter, 3-32 chars');

export const emailSchema = z.string().email().max(254);

export const passwordSchema = z.string().min(8).max(1024);

export const userPublic = z.object({
  id: z.string().uuid(),
  username: usernameSchema,
});

export type UserPublic = z.infer<typeof userPublic>;

export const userSelf = userPublic.extend({
  email: emailSchema,
  createdAt: z.string(),
});

export type UserSelf = z.infer<typeof userSelf>;
