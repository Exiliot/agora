/**
 * Logic-only tests for the rooms feature module. The full DB-backed
 * integration tests will come once test containers are wired for the API
 * workspace (see docs/plans once generated). For now, these exercise the
 * pure helpers that don't hit the database:
 *
 *   - isUniqueViolation: pg-side error recognition for unique-constraint hits
 *   - event publishers: bus topic + payload shape
 *
 * Anything that touches `db` is deliberately omitted so the spec runs in
 * isolation without provisioning Postgres.
 */

import { describe, expect, it, vi } from 'vitest';

describe('isUniqueViolation', () => {
  it('should recognise a pg unique-constraint error by code', async () => {
    const { isUniqueViolation } = await import('../../src/rooms/invitations.js');
    expect(isUniqueViolation({ code: '23505' })).toBe(true);
  });

  it('should reject non-matching error codes', async () => {
    const { isUniqueViolation } = await import('../../src/rooms/invitations.js');
    expect(isUniqueViolation({ code: '23502' })).toBe(false);
  });

  it('should reject values without a code property', async () => {
    const { isUniqueViolation } = await import('../../src/rooms/invitations.js');
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
    expect(isUniqueViolation('boom')).toBe(false);
    expect(isUniqueViolation({})).toBe(false);
  });
});

describe('room event publishers', () => {
  it('should publish room.member_joined on the room topic with the wire payload shape', async () => {
    const { bus } = await import('../../src/bus/bus.js');
    const { roomTopic } = await import('../../src/bus/topics.js');
    const { publishRoomMemberJoined } = await import('../../src/rooms/events.js');

    const roomId = '00000000-0000-0000-0000-000000000001';
    const user = { id: '00000000-0000-0000-0000-000000000002', username: 'alice' };
    const handler = vi.fn();
    const unsubscribe = bus.subscribe(roomTopic(roomId), handler);

    publishRoomMemberJoined(roomId, user);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      { type: 'room.member_joined', payload: { roomId, user } },
      undefined,
    );
    unsubscribe();
  });

  it('should publish room.deleted on the room topic', async () => {
    const { bus } = await import('../../src/bus/bus.js');
    const { roomTopic } = await import('../../src/bus/topics.js');
    const { publishRoomDeleted } = await import('../../src/rooms/events.js');

    const roomId = '00000000-0000-0000-0000-000000000003';
    const handler = vi.fn();
    const unsubscribe = bus.subscribe(roomTopic(roomId), handler);

    publishRoomDeleted(roomId);

    expect(handler).toHaveBeenCalledWith(
      { type: 'room.deleted', payload: { roomId } },
      undefined,
    );
    unsubscribe();
  });

  it('should publish room.access_lost on the user topic', async () => {
    const { bus } = await import('../../src/bus/bus.js');
    const { userTopic } = await import('../../src/bus/topics.js');
    const { publishRoomAccessLost } = await import('../../src/rooms/events.js');

    const userId = '00000000-0000-0000-0000-000000000004';
    const roomId = '00000000-0000-0000-0000-000000000005';
    const handler = vi.fn();
    const unsubscribe = bus.subscribe(userTopic(userId), handler);

    publishRoomAccessLost(userId, roomId, 'removed');

    expect(handler).toHaveBeenCalledWith(
      { type: 'room.access_lost', payload: { roomId, reason: 'removed' } },
      undefined,
    );
    unsubscribe();
  });

  it('should publish invitation.received on the target user topic', async () => {
    const { bus } = await import('../../src/bus/bus.js');
    const { userTopic } = await import('../../src/bus/topics.js');
    const { publishInvitationReceived } = await import('../../src/rooms/events.js');

    const targetId = '00000000-0000-0000-0000-000000000006';
    const payload = {
      id: 'inv-1',
      roomId: 'room-1',
      roomName: 'general',
      inviter: { id: 'inv-er', username: 'bob' },
    };
    const handler = vi.fn();
    const unsubscribe = bus.subscribe(userTopic(targetId), handler);

    publishInvitationReceived(targetId, payload);

    expect(handler).toHaveBeenCalledWith({ type: 'invitation.received', payload }, undefined);
    unsubscribe();
  });

  it('should publish room.member_removed with byUserId matching the shared schema', async () => {
    const { bus } = await import('../../src/bus/bus.js');
    const { roomTopic } = await import('../../src/bus/topics.js');
    const { publishRoomMemberRemoved } = await import('../../src/rooms/events.js');

    const roomId = '00000000-0000-0000-0000-000000000007';
    const target = '00000000-0000-0000-0000-000000000008';
    const by = '00000000-0000-0000-0000-000000000009';
    const handler = vi.fn();
    const off = bus.subscribe(roomTopic(roomId), handler);

    publishRoomMemberRemoved(roomId, target, by);

    expect(handler).toHaveBeenCalledWith(
      { type: 'room.member_removed', payload: { roomId, userId: target, byUserId: by } },
      undefined,
    );
    off();
  });
});
