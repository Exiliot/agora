import { z } from 'zod';
import { userPublic, usernameSchema } from '../users/index.js';

export const roomVisibility = z.enum(['public', 'private']);
export type RoomVisibility = z.infer<typeof roomVisibility>;

export const roomRole = z.enum(['owner', 'admin', 'member']);
export type RoomRole = z.infer<typeof roomRole>;

export const roomNameSchema = z
  .string()
  .min(2)
  .max(48)
  .regex(/^[a-z0-9][a-z0-9._-]*$/, 'room name must be lowercase, alphanumeric with . _ -');

export const createRoomRequest = z.object({
  name: roomNameSchema,
  description: z.string().max(280).optional(),
  visibility: roomVisibility,
});
export type CreateRoomRequest = z.infer<typeof createRoomRequest>;

export const roomSummary = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  visibility: roomVisibility,
  memberCount: z.number().int().nonnegative(),
});
export type RoomSummary = z.infer<typeof roomSummary>;

export const roomMember = z.object({
  user: userPublic,
  role: roomRole,
  joinedAt: z.string(),
});
export type RoomMember = z.infer<typeof roomMember>;

export const roomDetail = roomSummary.extend({
  owner: userPublic,
  admins: z.array(userPublic),
  members: z.array(roomMember),
  createdAt: z.string(),
});
export type RoomDetail = z.infer<typeof roomDetail>;

export const roomBanView = z.object({
  target: userPublic,
  banner: userPublic.nullable(),
  reason: z.string().nullable(),
  createdAt: z.string(),
});
export type RoomBanView = z.infer<typeof roomBanView>;

export const roomInvitationView = z.object({
  id: z.string().uuid(),
  room: roomSummary,
  inviter: userPublic.nullable(),
  createdAt: z.string(),
});
export type RoomInvitationView = z.infer<typeof roomInvitationView>;

export const inviteToRoomRequest = z.object({
  targetUsername: usernameSchema,
});
export type InviteToRoomRequest = z.infer<typeof inviteToRoomRequest>;
