/**
 * Initial presence bootstrap for a freshly-connected WS (ADR-0003,
 * ws-protocol.md §4/§7). Without this, the client only receives presence
 * transitions from the sweeper – users already steady-state `online` at the
 * moment of connect stay invisible until they transition again.
 */

import type { WsConnection } from '../ws/connection-manager.js';
import { getSnapshotForUsers } from './registry.js';
import { listPresenceSubscribers } from './subscription.js';

export const sendPresenceSnapshot = async (conn: WsConnection): Promise<void> => {
  const subscribers = await listPresenceSubscribers(conn.userId);
  const entries = getSnapshotForUsers(subscribers);
  conn.send({ type: 'presence.snapshot', payload: { entries } });
};
