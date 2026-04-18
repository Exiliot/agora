import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the DB + bus + focus registry before importing the publisher.
// Use vi.hoisted so the mock fns exist when the hoisted vi.mock factories run.
const { executeMock, publishMock, hydrateMock } = vi.hoisted(() => ({
  executeMock: vi.fn(),
  publishMock: vi.fn(),
  hydrateMock: vi.fn(),
}));

vi.mock('../db/client.js', () => ({
  db: {
    execute: (...args: unknown[]) => executeMock(...args),
    select: vi.fn(),
  },
}));

vi.mock('../bus/bus.js', () => ({
  bus: { publish: publishMock, subscribe: vi.fn() },
}));

vi.mock('./hydrate.js', () => ({ hydrateNotification: hydrateMock }));

import { publishNotification } from './publisher.js';
import { userFocusRegistry } from '../ws/user-focus.js';

const baseArgs = {
  userId: '00000000-0000-0000-0000-000000000001',
  subjectType: 'dm' as const,
  subjectId: '00000000-0000-0000-0000-000000000002',
  actorId: null,
  payload: { snippet: 'hi' },
};

describe('publishNotification', () => {
  beforeEach(() => {
    executeMock.mockReset();
    publishMock.mockReset();
    hydrateMock.mockReset();
    userFocusRegistry._clearAll();
  });

  it('writes a row and publishes for a focusable kind when user is not focused', async () => {
    executeMock.mockResolvedValue({ rows: [{ id: 'nid-1' }] });
    hydrateMock.mockResolvedValue({ id: 'nid-1', userId: baseArgs.userId });

    await publishNotification({ ...baseArgs, kind: 'dm.new_message' });

    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(hydrateMock).toHaveBeenCalledWith('nid-1');
    expect(publishMock).toHaveBeenCalledTimes(1);
  });

  it('suppresses dm.new_message when user is focused on the same subject', async () => {
    userFocusRegistry.set(baseArgs.userId, 'dm', baseArgs.subjectId);
    await publishNotification({ ...baseArgs, kind: 'dm.new_message' });
    expect(executeMock).not.toHaveBeenCalled();
    expect(publishMock).not.toHaveBeenCalled();
  });

  it('does NOT suppress friend.request even if a stale focus matches', async () => {
    executeMock.mockResolvedValue({ rows: [{ id: 'nid-2' }] });
    hydrateMock.mockResolvedValue({ id: 'nid-2', userId: baseArgs.userId });
    userFocusRegistry.set(baseArgs.userId, 'user', baseArgs.subjectId);
    await publishNotification({
      userId: baseArgs.userId,
      kind: 'friend.request',
      subjectType: 'user',
      subjectId: baseArgs.subjectId,
      actorId: null,
      payload: {},
    });
    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(publishMock).toHaveBeenCalledTimes(1);
  });

  it('skips publish when hydrate returns null (row vanished)', async () => {
    executeMock.mockResolvedValue({ rows: [{ id: 'nid-3' }] });
    hydrateMock.mockResolvedValue(null);
    await publishNotification({ ...baseArgs, kind: 'dm.new_message' });
    expect(publishMock).not.toHaveBeenCalled();
  });
});
