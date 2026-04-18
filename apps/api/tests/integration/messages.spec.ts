/**
 * Message module integration tests.
 *
 * These tests stub the DB client (the helpers are written so that they
 * compose around a small set of queries) and assert the permission and
 * pub-sub logic on the orchestration layer. A DB-backed end-to-end flow is
 * covered by the Playwright e2e suite once the rooms/friends features land.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/db/client.js', () => {
  const chain = {
    select: vi.fn(() => chain),
    from: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve([])),
    orderBy: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    values: vi.fn(() => chain),
    onConflictDoUpdate: vi.fn(() => chain),
    onConflictDoNothing: vi.fn(() => chain),
    returning: vi.fn(() => Promise.resolve([])),
    update: vi.fn(() => chain),
    set: vi.fn(() => chain),
    execute: vi.fn(() => Promise.resolve({ rows: [] })),
    transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(chain)),
  };
  return {
    db: chain,
    pool: { end: vi.fn() },
    pingDb: vi.fn().mockResolvedValue(true),
  };
});

import { db } from '../../src/db/client.js';
import { bus } from '../../src/bus/bus.js';

type ChainMock = {
  select: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
};

const mocked = db as unknown as ChainMock;

const resetChainResults = (results: unknown[][]): void => {
  // Each call to `.limit(...)` (awaited) resolves to the next queued result.
  let i = 0;
  mocked.limit.mockImplementation(() => {
    const next = results[i] ?? [];
    i += 1;
    return Promise.resolve(next);
  });
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('canAccessRoom', () => {
  it('should reject when a room ban exists', async () => {
    const { canAccessRoom } = await import('../../src/messages/permissions.js');
    resetChainResults([[{ targetId: 'u1' }]]);
    const result = await canAccessRoom('u1', 'r1');
    expect(result).toStrictEqual({ ok: false, code: 'banned' });
  });

  it('should reject when no membership exists', async () => {
    const { canAccessRoom } = await import('../../src/messages/permissions.js');
    resetChainResults([[], []]);
    const result = await canAccessRoom('u1', 'r1');
    expect(result).toStrictEqual({ ok: false, code: 'not_member' });
  });

  it('should allow a current member', async () => {
    const { canAccessRoom } = await import('../../src/messages/permissions.js');
    resetChainResults([[], [{ role: 'member' }]]);
    const result = await canAccessRoom('u1', 'r1');
    expect(result).toStrictEqual({ ok: true, role: 'member' });
  });
});

describe('canSendDm', () => {
  it('should reject self-send', async () => {
    const { canSendDm } = await import('../../src/messages/permissions.js');
    const result = await canSendDm('u1', 'u1');
    expect(result).toStrictEqual({ ok: false, code: 'not_friend' });
  });

  it('should reject when either side has banned the other', async () => {
    const { canSendDm } = await import('../../src/messages/permissions.js');
    resetChainResults([[{ bannerId: 'u2' }]]);
    const result = await canSendDm('u1', 'u2');
    expect(result).toStrictEqual({ ok: false, code: 'banned' });
  });

  it('should reject when no friendship row exists', async () => {
    const { canSendDm } = await import('../../src/messages/permissions.js');
    resetChainResults([[], []]);
    const result = await canSendDm('u1', 'u2');
    expect(result).toStrictEqual({ ok: false, code: 'not_friend' });
  });

  it('should allow friends with no bans', async () => {
    const { canSendDm } = await import('../../src/messages/permissions.js');
    resetChainResults([[], [{ userAId: 'u1' }]]);
    const result = await canSendDm('u1', 'u2');
    expect(result).toStrictEqual({ ok: true });
  });
});

describe('loadDmForUser', () => {
  it('should return not_found when the dm id does not exist', async () => {
    const { loadDmForUser } = await import('../../src/messages/permissions.js');
    resetChainResults([[]]);
    const result = await loadDmForUser('u1', 'dm1');
    expect(result).toStrictEqual({ ok: false, code: 'not_found' });
  });

  it('should return not_member when caller is not a participant', async () => {
    const { loadDmForUser } = await import('../../src/messages/permissions.js');
    resetChainResults([[{ id: 'dm1', userAId: 'other1', userBId: 'other2' }]]);
    const result = await loadDmForUser('u1', 'dm1');
    expect(result).toStrictEqual({ ok: false, code: 'not_member' });
  });

  it('should return the other user id when caller is a participant', async () => {
    const { loadDmForUser } = await import('../../src/messages/permissions.js');
    resetChainResults([[{ id: 'dm1', userAId: 'u1', userBId: 'u2' }]]);
    const result = await loadDmForUser('u1', 'dm1');
    expect(result).toStrictEqual({
      ok: true,
      conversation: { id: 'dm1', userAId: 'u1', userBId: 'u2' },
      otherUserId: 'u2',
    });
  });
});

describe('bus topic publication', () => {
  it('should scope room message topics to the conversation id', () => {
    const received: unknown[] = [];
    const off = bus.subscribe('room:abc', (e) => received.push(e));
    bus.publish('room:abc', { type: 'message.new', payload: { id: 'm1' } });
    bus.publish('room:xyz', { type: 'message.new', payload: { id: 'm2' } });
    off();
    expect(received).toStrictEqual([{ type: 'message.new', payload: { id: 'm1' } }]);
  });

  it('should deliver unread.updated events to the user topic', () => {
    const received: unknown[] = [];
    const off = bus.subscribe('user:u1', (e) => received.push(e));
    bus.publish('user:u1', {
      type: 'unread.updated',
      payload: { conversationType: 'room', conversationId: 'r1', count: 3 },
    });
    off();
    expect(received).toHaveLength(1);
  });
});
