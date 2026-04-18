/**
 * Deterministic state-machine tests for the presence registry. Uses vitest's
 * fake timers so the AFK threshold and grace window can be advanced without
 * real wall-clock waits.
 *
 * Covers ADR-0003's happy-path transitions:
 *   - no tabs registered -> offline
 *   - tab idle for > AFK_THRESHOLD -> afk
 *   - fresh activity on the same tab -> back to online
 *   - all tabs removed -> offline
 *   - grace window + re-register -> tab survives (no flicker)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../config.js';
import {
  __resetPresenceForTests,
  computeStateFor,
  getSnapshotForUsers,
  recordActivity,
  registerTab,
  removeTab,
  scheduleRemoveTab,
} from './registry.js';

const USER = '00000000-0000-0000-0000-000000000001';
const TAB_A = 'tab-aaaaaaaa';
const TAB_B = 'tab-bbbbbbbb';

describe('presence registry state machine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    __resetPresenceForTests();
  });

  afterEach(() => {
    __resetPresenceForTests();
    vi.useRealTimers();
  });

  it('should report offline when no tabs are registered', () => {
    expect(computeStateFor(USER)).toBe('offline');
  });

  it('should report online immediately after a tab is registered', () => {
    registerTab(USER, TAB_A);
    expect(computeStateFor(USER)).toBe('online');
  });

  it('should transition to afk once the tab has been idle past the threshold', () => {
    registerTab(USER, TAB_A);
    vi.advanceTimersByTime(config.PRESENCE_AFK_THRESHOLD_MS + 1_000);
    expect(computeStateFor(USER)).toBe('afk');
  });

  it('should return to online when fresh activity lands on an idle tab', () => {
    registerTab(USER, TAB_A);
    vi.advanceTimersByTime(config.PRESENCE_AFK_THRESHOLD_MS + 1_000);
    expect(computeStateFor(USER)).toBe('afk');

    recordActivity(USER, TAB_A);
    expect(computeStateFor(USER)).toBe('online');
  });

  it('should stay online if any one tab is active even when others are idle', () => {
    registerTab(USER, TAB_A);
    vi.advanceTimersByTime(config.PRESENCE_AFK_THRESHOLD_MS + 1_000);
    registerTab(USER, TAB_B);
    expect(computeStateFor(USER)).toBe('online');
  });

  it('should go offline once the last tab is removed', () => {
    registerTab(USER, TAB_A);
    registerTab(USER, TAB_B);
    removeTab(USER, TAB_A);
    expect(computeStateFor(USER)).toBe('online');
    removeTab(USER, TAB_B);
    expect(computeStateFor(USER)).toBe('offline');
  });

  it('should preserve presence across a reconnect inside the grace window', () => {
    registerTab(USER, TAB_A);
    scheduleRemoveTab(USER, TAB_A);

    // reconnect before the grace timer fires
    vi.advanceTimersByTime(config.PRESENCE_TAB_GRACE_MS - 1_000);
    registerTab(USER, TAB_A);

    // advance past when the cancelled timer would have fired
    vi.advanceTimersByTime(5_000);
    expect(computeStateFor(USER)).toBe('online');
  });

  it('should drop the tab after the grace window lapses without a reconnect', () => {
    registerTab(USER, TAB_A);
    scheduleRemoveTab(USER, TAB_A);
    vi.advanceTimersByTime(config.PRESENCE_TAB_GRACE_MS + 1_000);
    expect(computeStateFor(USER)).toBe('offline');
  });

  it('should report offline for users never seen in getSnapshotForUsers', () => {
    registerTab(USER, TAB_A);
    const snap = getSnapshotForUsers([USER, 'unknown-user']);
    expect(snap).toStrictEqual([
      { userId: USER, state: 'online' },
      { userId: 'unknown-user', state: 'offline' },
    ]);
  });

  it('should ignore recordActivity for an unknown tab rather than throwing', () => {
    expect(() => recordActivity(USER, TAB_A)).not.toThrow();
    expect(computeStateFor(USER)).toBe('offline');
  });
});
