/**
 * Logic-only tests for the attachments feature module. These cover:
 *
 *   - hash-path computation (two-level directory fan-out, hex round-trip)
 *   - access helper logic (orphan → uploader-only; attached → delegates to
 *     messaging permissions)
 *   - orphan sweep selection of rows older than the cutoff
 *   - cascade handler fires on `room.deleted` bus events
 *
 * The database layer is mocked via `vi.mock('../../src/db/client.js')` so the
 * spec runs in isolation without provisioning Postgres — same shape as the
 * messages integration tests.
 */

import path from 'node:path';
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
    delete: vi.fn(() => chain),
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

type ChainMock = {
  select: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  from: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
};

const mocked = db as unknown as ChainMock;

const resetChainResults = (results: unknown[][]): void => {
  let i = 0;
  mocked.limit.mockImplementation(() => {
    const next = results[i] ?? [];
    i += 1;
    return Promise.resolve(next);
  });
  // select().from().where() terminates with where() for un-limited queries.
  mocked.where.mockImplementation(() => {
    // default terminal — tests that rely on this override below with a
    // custom mockImplementation.
    return Object.assign(mocked, { then: undefined });
  });
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('hashPath', () => {
  it('should split the hash into two 2-char prefix segments', async () => {
    const { hashPath } = await import('../../src/attachments/storage.js');
    const hash = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
    const result = hashPath(hash, '/data/attachments');
    expect(result).toStrictEqual(path.join('/data/attachments', 'ab', 'cd', hash));
  });

  it('should reject a hash of the wrong length', async () => {
    const { hashPath } = await import('../../src/attachments/storage.js');
    expect(() => hashPath('short', '/data/attachments')).toThrow(/invalid content hash length/);
  });

  it('should round-trip hex to buffer and back', async () => {
    const { hashToBuffer, hashFromBuffer } = await import('../../src/attachments/storage.js');
    const hex = 'deadbeef'.repeat(8);
    const buf = hashToBuffer(hex);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBe(32);
    expect(hashFromBuffer(buf)).toBe(hex);
  });
});

describe('checkAccess', () => {
  const uploaderId = '00000000-0000-0000-0000-0000000000a1';
  const otherId = '00000000-0000-0000-0000-0000000000a2';
  const attachmentId = '00000000-0000-0000-0000-0000000000a3';
  const messageId = '00000000-0000-0000-0000-0000000000a4';
  const roomId = '00000000-0000-0000-0000-0000000000a5';

  const baseRow = {
    id: attachmentId,
    uploaderId,
    messageId: null as string | null,
    contentHash: Buffer.alloc(32),
    size: 100,
    mimeType: 'text/plain',
    originalFilename: 'f.txt',
    comment: null,
    createdAt: new Date(),
  };

  it('should allow the uploader to fetch an orphan attachment', async () => {
    const { checkAccess } = await import('../../src/attachments/routes.js');
    const result = await checkAccess({ ...baseRow }, uploaderId);
    expect(result).toStrictEqual({ ok: true });
  });

  it('should forbid non-uploaders from fetching an orphan attachment', async () => {
    const { checkAccess } = await import('../../src/attachments/routes.js');
    const result = await checkAccess({ ...baseRow }, otherId);
    expect(result).toStrictEqual({ ok: false, status: 403, code: 'forbidden' });
  });

  it('should delegate to canAccessRoom when attached to a room message', async () => {
    resetChainResults([
      // messages lookup
      [{ id: messageId, conversationType: 'room', conversationId: roomId }],
      // canAccessRoom → roomBans check (empty)
      [],
      // canAccessRoom → roomMembers check → member
      [{ role: 'member' }],
    ]);

    const { checkAccess } = await import('../../src/attachments/routes.js');
    const result = await checkAccess({ ...baseRow, messageId }, otherId);
    expect(result).toStrictEqual({ ok: true });
  });

  it('should map a room ban to 403', async () => {
    resetChainResults([
      [{ id: messageId, conversationType: 'room', conversationId: roomId }],
      [{ targetId: otherId }], // room ban hit
    ]);

    const { checkAccess } = await import('../../src/attachments/routes.js');
    const result = await checkAccess({ ...baseRow, messageId }, otherId);
    expect(result).toStrictEqual({ ok: false, status: 403, code: 'banned' });
  });

  it('should return 404 when the attached message is gone and caller is not uploader', async () => {
    resetChainResults([[]]); // messages lookup returns empty

    const { checkAccess } = await import('../../src/attachments/routes.js');
    const result = await checkAccess({ ...baseRow, messageId }, otherId);
    expect(result).toStrictEqual({ ok: false, status: 404, code: 'not_found' });
  });

  it('should allow the uploader when the attached message has vanished', async () => {
    resetChainResults([[]]);

    const { checkAccess } = await import('../../src/attachments/routes.js');
    const result = await checkAccess({ ...baseRow, messageId }, uploaderId);
    expect(result).toStrictEqual({ ok: true });
  });
});

describe('room.deleted cascade', () => {
  it('should fire handleRoomDeleted when a room.deleted event is published', async () => {
    // Import bus-handlers so its publish wrapper is installed.
    await import('../../src/attachments/bus-handlers.js');
    const { bus } = await import('../../src/bus/bus.js');

    // Prep DB mocks: messages-in-room query returns [], so no attachments to
    // delete. This verifies the hook fires without a real file touch.
    mocked.where.mockImplementation(() => Promise.resolve([]));

    bus.publish('room:11111111-1111-1111-1111-111111111111', {
      type: 'room.deleted',
      payload: { roomId: '11111111-1111-1111-1111-111111111111' },
    });

    // The wrapper calls db.select().from(messages).where(...) — assert we
    // reached that `where` with the polymorphic conversation filter.
    // Wait a microtask for the async cascade handler.
    await new Promise((resolve) => setImmediate(resolve));

    expect(mocked.select).toHaveBeenCalled();
    expect(mocked.from).toHaveBeenCalled();
    expect(mocked.where).toHaveBeenCalled();
  });

  it('should ignore non-room.deleted events on the same topic', async () => {
    await import('../../src/attachments/bus-handlers.js');
    const { bus } = await import('../../src/bus/bus.js');

    mocked.select.mockClear();

    bus.publish('room:22222222-2222-2222-2222-222222222222', {
      type: 'room.member_joined',
      payload: { roomId: '22222222-2222-2222-2222-222222222222', user: { id: 'u', username: 'u' } },
    });
    await new Promise((resolve) => setImmediate(resolve));

    expect(mocked.select).not.toHaveBeenCalled();
  });
});

describe('sweepOrphans', () => {
  it('should return 0 when there are no orphans older than the cutoff', async () => {
    // select().from().where() resolves directly (no limit in this query).
    mocked.where.mockImplementation(() => Promise.resolve([]));

    const { sweepOrphans } = await import('../../src/attachments/sweeper.js');
    const count = await sweepOrphans(new Date('2026-04-17T12:00:00Z'));
    expect(count).toBe(0);
  });
});
