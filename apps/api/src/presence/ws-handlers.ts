/**
 * WS wiring for the presence feature. Runs at module import:
 *
 *   - Register `heartbeat` on the dispatcher to refresh the tab's
 *     `lastActivityAt`.
 *   - Listen for `hello` on the connection lifecycle to register the tab as
 *     soon as the plugin attaches `tabId`.
 *   - Listen for `close` to schedule tab removal after
 *     `PRESENCE_TAB_GRACE_MS`; a fresh `hello` with the same tab id cancels
 *     the removal (reconnect tolerance, ADR-0003).
 */

import { registerWsHandler } from '../ws/dispatcher.js';
import { connectionLifecycle } from '../ws/lifecycle.js';
import { recordActivity, registerTab, scheduleRemoveTab } from './registry.js';

registerWsHandler('heartbeat', (ctx) => {
  const { userId, tabId } = ctx.conn;
  if (!tabId) return;
  recordActivity(userId, tabId);
});

connectionLifecycle.on('hello', (conn) => {
  if (!conn.tabId) return;
  registerTab(conn.userId, conn.tabId);
});

connectionLifecycle.on('close', (conn) => {
  if (!conn.tabId) return;
  scheduleRemoveTab(conn.userId, conn.tabId);
});
