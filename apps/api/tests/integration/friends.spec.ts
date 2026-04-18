/**
 * Logic-only tests for the friends feature module. Mirrors the rooms spec
 * style: no DB provisioned, just the pure helpers and the typed event
 * publishers. DB-backed integration will land alongside the testcontainers
 * fixture shared across feature modules.
 */

import { describe, expect, it, vi } from 'vitest';

describe('pairKey', () => {
  it('should return the smaller UUID first regardless of argument order', async () => {
    const { pairKey } = await import('../../src/friends/db-helpers.js');
    const u1 = '00000000-0000-0000-0000-000000000001';
    const u2 = '00000000-0000-0000-0000-000000000002';

    expect(pairKey(u1, u2)).toStrictEqual({ a: u1, b: u2 });
    expect(pairKey(u2, u1)).toStrictEqual({ a: u1, b: u2 });
  });

  it('should compare lexicographically on full UUID string', async () => {
    const { pairKey } = await import('../../src/friends/db-helpers.js');
    const low = '11111111-1111-1111-1111-111111111111';
    const high = '22222222-2222-2222-2222-222222222222';

    expect(pairKey(high, low)).toStrictEqual({ a: low, b: high });
  });
});

describe('isUniqueViolation (friends)', () => {
  it('should recognise the pg 23505 unique-constraint code', async () => {
    const { isUniqueViolation } = await import('../../src/friends/db-helpers.js');
    expect(isUniqueViolation({ code: '23505' })).toBe(true);
  });

  it('should reject anything else', async () => {
    const { isUniqueViolation } = await import('../../src/friends/db-helpers.js');
    expect(isUniqueViolation({ code: '23502' })).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation({})).toBe(false);
  });
});

describe('friends event publishers', () => {
  it('should publish friend.request_received on the recipient topic', async () => {
    const { bus } = await import('../../src/bus/bus.js');
    const { userTopic } = await import('../../src/bus/topics.js');
    const { publishFriendRequestReceived } = await import('../../src/friends/events.js');

    const recipientId = '00000000-0000-0000-0000-00000000aa01';
    const payload = {
      id: '00000000-0000-0000-0000-00000000aa02',
      sender: { id: '00000000-0000-0000-0000-00000000aa03', username: 'alice' },
      note: 'hi',
    };
    const handler = vi.fn();
    const off = bus.subscribe(userTopic(recipientId), handler);

    publishFriendRequestReceived(recipientId, payload);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ type: 'friend.request_received', payload });
    off();
  });

  it('should publish friendship.created on a user topic with counterparty id', async () => {
    const { bus } = await import('../../src/bus/bus.js');
    const { userTopic } = await import('../../src/bus/topics.js');
    const { publishFriendshipCreated } = await import('../../src/friends/events.js');

    const me = '00000000-0000-0000-0000-00000000bb01';
    const other = '00000000-0000-0000-0000-00000000bb02';
    const handler = vi.fn();
    const off = bus.subscribe(userTopic(me), handler);

    publishFriendshipCreated(me, other);

    expect(handler).toHaveBeenCalledWith({
      type: 'friendship.created',
      payload: { userId: other },
    });
    off();
  });

  it('should publish friendship.removed on both sides independently', async () => {
    const { bus } = await import('../../src/bus/bus.js');
    const { userTopic } = await import('../../src/bus/topics.js');
    const { publishFriendshipRemoved } = await import('../../src/friends/events.js');

    const me = '00000000-0000-0000-0000-00000000cc01';
    const other = '00000000-0000-0000-0000-00000000cc02';
    const myHandler = vi.fn();
    const otherHandler = vi.fn();
    const offMine = bus.subscribe(userTopic(me), myHandler);
    const offTheirs = bus.subscribe(userTopic(other), otherHandler);

    publishFriendshipRemoved(me, other);
    publishFriendshipRemoved(other, me);

    expect(myHandler).toHaveBeenCalledWith({
      type: 'friendship.removed',
      payload: { userId: other },
    });
    expect(otherHandler).toHaveBeenCalledWith({
      type: 'friendship.removed',
      payload: { userId: me },
    });

    offMine();
    offTheirs();
  });

  it('should publish user_ban.created with banner and target ids', async () => {
    const { bus } = await import('../../src/bus/bus.js');
    const { userTopic } = await import('../../src/bus/topics.js');
    const { publishUserBanCreated } = await import('../../src/friends/events.js');

    const banner = '00000000-0000-0000-0000-00000000dd01';
    const target = '00000000-0000-0000-0000-00000000dd02';
    const bannerHandler = vi.fn();
    const targetHandler = vi.fn();
    const offBanner = bus.subscribe(userTopic(banner), bannerHandler);
    const offTarget = bus.subscribe(userTopic(target), targetHandler);

    publishUserBanCreated(banner, banner, target);
    publishUserBanCreated(target, banner, target);

    expect(bannerHandler).toHaveBeenCalledWith({
      type: 'user_ban.created',
      payload: { bannerId: banner, targetId: target },
    });
    expect(targetHandler).toHaveBeenCalledWith({
      type: 'user_ban.created',
      payload: { bannerId: banner, targetId: target },
    });

    offBanner();
    offTarget();
  });

  it('should publish user_ban.removed mirroring user_ban.created', async () => {
    const { bus } = await import('../../src/bus/bus.js');
    const { userTopic } = await import('../../src/bus/topics.js');
    const { publishUserBanRemoved } = await import('../../src/friends/events.js');

    const banner = '00000000-0000-0000-0000-00000000ee01';
    const target = '00000000-0000-0000-0000-00000000ee02';
    const handler = vi.fn();
    const off = bus.subscribe(userTopic(banner), handler);

    publishUserBanRemoved(banner, banner, target);

    expect(handler).toHaveBeenCalledWith({
      type: 'user_ban.removed',
      payload: { bannerId: banner, targetId: target },
    });
    off();
  });

  it('should publish friend.request_cancelled on the recipient topic', async () => {
    const { bus } = await import('../../src/bus/bus.js');
    const { userTopic } = await import('../../src/bus/topics.js');
    const { publishFriendRequestCancelled } = await import('../../src/friends/events.js');

    const recipientId = '00000000-0000-0000-0000-00000000ff01';
    const requestId = '00000000-0000-0000-0000-00000000ff02';
    const handler = vi.fn();
    const off = bus.subscribe(userTopic(recipientId), handler);

    publishFriendRequestCancelled(recipientId, requestId);

    expect(handler).toHaveBeenCalledWith({
      type: 'friend.request_cancelled',
      payload: { requestId },
    });
    off();
  });
});
