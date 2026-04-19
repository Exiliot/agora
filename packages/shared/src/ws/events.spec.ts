import { describe, expect, it } from 'vitest';
import {
  friendRequestCancelledEvent,
  friendshipRemovedEvent,
  roomAdminAddedEvent,
  roomAdminRemovedEvent,
  roomDeletedEvent,
  roomMemberLeftEvent,
  roomMemberRemovedEvent,
  serverToClientEvent,
  userBanCreatedEvent,
  userBanRemovedEvent,
} from './events.js';

const uuidA = '00000000-0000-0000-0000-00000000000a';
const uuidB = '00000000-0000-0000-0000-00000000000b';
const uuidC = '00000000-0000-0000-0000-00000000000c';

describe('server-to-client event schemas', () => {
  it('should accept friendship.removed', () => {
    const parsed = friendshipRemovedEvent.safeParse({
      type: 'friendship.removed',
      payload: { userId: uuidA },
    });
    expect(parsed.success).toBe(true);
  });

  it('should accept user_ban.created and user_ban.removed', () => {
    expect(
      userBanCreatedEvent.safeParse({
        type: 'user_ban.created',
        payload: { bannerId: uuidA, targetId: uuidB },
      }).success,
    ).toBe(true);
    expect(
      userBanRemovedEvent.safeParse({
        type: 'user_ban.removed',
        payload: { bannerId: uuidA, targetId: uuidB },
      }).success,
    ).toBe(true);
  });

  it('should accept friend.request_cancelled', () => {
    const parsed = friendRequestCancelledEvent.safeParse({
      type: 'friend.request_cancelled',
      payload: { requestId: uuidA },
    });
    expect(parsed.success).toBe(true);
  });

  it('should accept room.admin_added and room.admin_removed', () => {
    expect(
      roomAdminAddedEvent.safeParse({
        type: 'room.admin_added',
        payload: { roomId: uuidA, userId: uuidB },
      }).success,
    ).toBe(true);
    expect(
      roomAdminRemovedEvent.safeParse({
        type: 'room.admin_removed',
        payload: { roomId: uuidA, userId: uuidB },
      }).success,
    ).toBe(true);
  });

  it('should accept room.member_left, room.member_removed and room.deleted', () => {
    expect(
      roomMemberLeftEvent.safeParse({
        type: 'room.member_left',
        payload: { roomId: uuidA, userId: uuidB },
      }).success,
    ).toBe(true);
    expect(
      roomMemberRemovedEvent.safeParse({
        type: 'room.member_removed',
        payload: { roomId: uuidA, userId: uuidB, byUserId: uuidC },
      }).success,
    ).toBe(true);
    expect(
      roomDeletedEvent.safeParse({
        type: 'room.deleted',
        payload: { roomId: uuidA },
      }).success,
    ).toBe(true);
  });

  it('should route unknown members through the discriminated union', () => {
    const parsed = serverToClientEvent.safeParse({
      type: 'friend.request_cancelled',
      payload: { requestId: uuidA },
    });
    expect(parsed.success).toBe(true);
    const bad = serverToClientEvent.safeParse({
      type: 'definitely.not.a.thing',
      payload: {},
    });
    expect(bad.success).toBe(false);
  });
});
