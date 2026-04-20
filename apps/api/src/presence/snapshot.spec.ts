/**
 * Verifies that a freshly-connected WS receives a `presence.snapshot` for
 * every user it subscribes to (friends + room co-members). This is the
 * initial-state bootstrap promised by ADR-0003 and ws-protocol.md §4/§7 –
 * without it, a late-joining tab sees collaborators as offline until they
 * transition (e.g. go AFK and back).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { listPresenceSubscribersMock } = vi.hoisted(() => ({
  listPresenceSubscribersMock: vi.fn<(userId: string) => Promise<string[]>>(),
}));

vi.mock('./subscription.js', () => ({
  listPresenceSubscribers: listPresenceSubscribersMock,
}));

import { __resetPresenceForTests, registerTab } from './registry.js';
import { sendPresenceSnapshot } from './snapshot.js';
import type { WsConnection } from '../ws/connection-manager.js';

const USER_SELF = '00000000-0000-0000-0000-00000000000a';
const USER_FRIEND = '00000000-0000-0000-0000-00000000000b';
const USER_ROOMMATE = '00000000-0000-0000-0000-00000000000c';

const fakeConn = (userId: string): { conn: WsConnection; sent: unknown[] } => {
  const sent: unknown[] = [];
  const conn = {
    id: 'conn-1',
    userId,
    tabId: 'tab-x',
    socket: {} as never,
    subscriptions: new Map<string, () => void>(),
    send: (event: unknown) => sent.push(event),
    sendRaw: () => {},
    closeWith: () => {},
    isBackpressured: () => false,
    sampleBackpressure: () => false,
  } as unknown as WsConnection;
  return { conn, sent };
};

describe('sendPresenceSnapshot', () => {
  beforeEach(() => {
    __resetPresenceForTests();
    listPresenceSubscribersMock.mockReset();
  });

  afterEach(() => {
    __resetPresenceForTests();
  });

  it('should send a presence.snapshot covering every subscribed user', async () => {
    registerTab(USER_FRIEND, 'tab-friend');
    listPresenceSubscribersMock.mockResolvedValue([USER_FRIEND, USER_ROOMMATE]);

    const { conn, sent } = fakeConn(USER_SELF);
    await sendPresenceSnapshot(conn);

    expect(listPresenceSubscribersMock).toHaveBeenCalledWith(USER_SELF);
    expect(sent).toStrictEqual([
      {
        type: 'presence.snapshot',
        payload: {
          entries: [
            { userId: USER_FRIEND, state: 'online' },
            { userId: USER_ROOMMATE, state: 'offline' },
          ],
        },
      },
    ]);
  });

  it('should still emit an empty snapshot when the user has no subscribers', async () => {
    listPresenceSubscribersMock.mockResolvedValue([]);

    const { conn, sent } = fakeConn(USER_SELF);
    await sendPresenceSnapshot(conn);

    expect(sent).toStrictEqual([
      { type: 'presence.snapshot', payload: { entries: [] } },
    ]);
  });
});
