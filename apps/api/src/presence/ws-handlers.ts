/**
 * WS wiring for the presence feature. Runs at module import:
 *
 *   - Register `heartbeat` on the dispatcher to refresh the tab's
 *     `lastActivityAt`.
 *   - Listen for `hello` on the connection lifecycle to register the tab as
 *     soon as the plugin attaches `tabId`, then push a `presence.snapshot`
 *     so the late-joining tab sees current state for friends + room
 *     co-members without waiting for the next transition.
 *   - Listen for `close` to schedule tab removal after
 *     `PRESENCE_TAB_GRACE_MS`; a fresh `hello` with the same tab id cancels
 *     the removal (reconnect tolerance, ADR-0003).
 */

import { registerWsHandler } from '../ws/dispatcher.js';
import { connectionLifecycle } from '../ws/lifecycle.js';
import { recordActivity, registerTab, scheduleRemoveTab } from './registry.js';
import { sendPresenceSnapshot } from './snapshot.js';

registerWsHandler('heartbeat', (ctx) => {
  const { userId, tabId } = ctx.conn;
  if (!tabId) return;
  recordActivity(userId, tabId);
});

connectionLifecycle.on('hello', (conn) => {
  if (!conn.tabId) return;
  registerTab(conn.userId, conn.tabId);
  void sendPresenceSnapshot(conn).catch((err) => {
    // A DB blip in listPresenceSubscribers shouldn't break the connection –
    // the sweeper will still push transitions as they happen.
    // eslint-disable-next-line no-console
    console.error('[presence] snapshot failed', { userId: conn.userId, err });
  });
});

connectionLifecycle.on('close', (conn) => {
  if (!conn.tabId) return;
  scheduleRemoveTab(conn.userId, conn.tabId);
});
