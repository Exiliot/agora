import { z } from 'zod';
import { emailSchema, passwordSchema, userSelf, usernameSchema } from '../users/index.js';

export const registerRequest = z.object({
  email: emailSchema,
  username: usernameSchema,
  password: passwordSchema,
});
export type RegisterRequest = z.infer<typeof registerRequest>;

export const signInRequest = z.object({
  email: emailSchema,
  password: passwordSchema,
});
export type SignInRequest = z.infer<typeof signInRequest>;

export const passwordResetRequest = z.object({
  email: emailSchema,
});
export type PasswordResetRequest = z.infer<typeof passwordResetRequest>;

export const passwordResetConsume = z.object({
  token: z.string().min(16).max(256),
  password: passwordSchema,
});
export type PasswordResetConsume = z.infer<typeof passwordResetConsume>;

export const passwordChangeRequest = z.object({
  currentPassword: passwordSchema,
  newPassword: passwordSchema,
});
export type PasswordChangeRequest = z.infer<typeof passwordChangeRequest>;

export const authResponse = z.object({
  user: userSelf,
});
export type AuthResponse = z.infer<typeof authResponse>;
