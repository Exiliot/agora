/**
 * Topic naming conventions for the in-process bus.
 *
 *   room:<uuid>  — events scoped to one room
 *   dm:<uuid>    — events scoped to one personal dialog
 *   user:<uuid>  — events targeted at a user (notifications, presence)
 */

export const roomTopic = (roomId: string): string => `room:${roomId}`;
export const dmTopic = (dmId: string): string => `dm:${dmId}`;
export const userTopic = (userId: string): string => `user:${userId}`;
