/**
 * In-memory presence registry (ADR-0003).
 *
 * Presence state is aggregated from per-tab heartbeats and never persisted to
 * the database (AC-PRESENCE-1). A user's computed state is the reduction over
 * their tab map:
 *
 *   no tabs                                     -> offline
 *   any tab with (now - lastActivityAt) <= AFK  -> online
 *   otherwise                                   -> afk
 *
 * The map is mutated synchronously from WS handlers and read by the sweeper;
 * Node's single-threaded event loop makes this safe without extra locking.
 */

import type { PresenceState } from '@agora/shared';
import { config } from '../config.js';

interface TabState {
  lastActivityAt: number;
}

const presence: Map<string, Map<string, TabState>> = new Map();

/**
 * Pending removals scheduled by `scheduleRemoveTab`. Stored so a `hello` with
 * the same tab id within the grace window can cancel the removal and avoid a
 * presence flicker on quick WS reconnects.
 */
const pendingRemovals: Map<string, Map<string, NodeJS.Timeout>> = new Map();

const now = (): number => Date.now();

const cancelPending = (userId: string, tabId: string): void => {
  const tabs = pendingRemovals.get(userId);
  if (!tabs) return;
  const handle = tabs.get(tabId);
  if (!handle) return;
  clearTimeout(handle);
  tabs.delete(tabId);
  if (tabs.size === 0) pendingRemovals.delete(userId);
};

export const registerTab = (userId: string, tabId: string): void => {
  cancelPending(userId, tabId);
  const tabs = presence.get(userId) ?? new Map<string, TabState>();
  tabs.set(tabId, { lastActivityAt: now() });
  presence.set(userId, tabs);
};

export const recordActivity = (userId: string, tabId: string): void => {
  const tabs = presence.get(userId);
  if (!tabs) return;
  const tab = tabs.get(tabId);
  if (!tab) return;
  tab.lastActivityAt = now();
};

/**
 * Immediately drops the tab. Use this after the `PRESENCE_TAB_GRACE_MS` window
 * has elapsed; `scheduleRemoveTab` is the usual entry point.
 */
export const removeTab = (userId: string, tabId: string): void => {
  cancelPending(userId, tabId);
  const tabs = presence.get(userId);
  if (!tabs) return;
  tabs.delete(tabId);
  if (tabs.size === 0) presence.delete(userId);
};

/**
 * Defer tab removal by `PRESENCE_TAB_GRACE_MS`. If the same tab re-registers
 * (via `registerTab`) within the window the timer is cancelled and presence
 * does not flicker.
 */
export const scheduleRemoveTab = (userId: string, tabId: string): void => {
  cancelPending(userId, tabId);
  const handle = setTimeout(() => {
    removeTab(userId, tabId);
  }, config.PRESENCE_TAB_GRACE_MS);
  // Don't keep the event loop alive solely for grace-period timers.
  if (typeof handle.unref === 'function') handle.unref();
  const tabs = pendingRemovals.get(userId) ?? new Map<string, NodeJS.Timeout>();
  tabs.set(tabId, handle);
  pendingRemovals.set(userId, tabs);
};

export const computeStateFor = (userId: string): PresenceState => {
  const tabs = presence.get(userId);
  if (!tabs || tabs.size === 0) return 'offline';
  const threshold = config.PRESENCE_AFK_THRESHOLD_MS;
  const currentTs = now();
  for (const tab of tabs.values()) {
    if (currentTs - tab.lastActivityAt <= threshold) return 'online';
  }
  return 'afk';
};

export const listTrackedUserIds = (): string[] => Array.from(presence.keys());

export const hasUser = (userId: string): boolean => presence.has(userId);

/**
 * Snapshot accessor for other features (e.g. a future route that seeds the
 * client with presence state for every member of a room it just opened).
 * Users absent from the registry are reported as `offline`.
 */
export const getSnapshotForUsers = (
  userIds: string[],
): Array<{ userId: string; state: PresenceState }> =>
  userIds.map((userId) => ({ userId, state: computeStateFor(userId) }));

/**
 * Test hook. Resets all in-memory state and clears pending timers. Not used in
 * production code paths.
 */
export const __resetPresenceForTests = (): void => {
  for (const tabs of pendingRemovals.values()) {
    for (const handle of tabs.values()) clearTimeout(handle);
  }
  pendingRemovals.clear();
  presence.clear();
};
