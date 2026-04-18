/**
 * Periodic presence sweeper (ADR-0003).
 *
 * Every `PRESENCE_SWEEP_INTERVAL_MS` the sweeper walks every tracked user,
 * recomputes their aggregate state, and publishes `presence.update` on each
 * subscriber's `user:<id>` topic if the state changed since the last tick.
 *
 * Users who have transitioned to `offline` are emitted once and then dropped
 * from `lastBroadcast` so we don't keep re-emitting offline for long-gone
 * tabs.
 */

import type { PresenceState } from '@agora/shared';
import { bus } from '../bus/bus.js';
import { userTopic } from '../bus/topics.js';
import { config } from '../config.js';
import { computeStateFor, listTrackedUserIds } from './registry.js';
import { listPresenceSubscribers } from './subscription.js';

const lastBroadcast: Map<string, PresenceState> = new Map();

const broadcast = async (userId: string, state: PresenceState): Promise<void> => {
  const subscribers = await listPresenceSubscribers(userId);
  const event = { type: 'presence.update', payload: { userId, state } };
  for (const subscriberId of subscribers) {
    bus.publish(userTopic(subscriberId), event);
  }
  // The transitioning user's own tabs also want to know (multi-tab coherence).
  bus.publish(userTopic(userId), event);
};

export const sweepOnce = async (): Promise<void> => {
  const tracked = new Set(listTrackedUserIds());
  // Also sweep users who were online/afk last tick but whose tabs have now
  // been removed from the registry — they need the offline transition.
  for (const userId of lastBroadcast.keys()) tracked.add(userId);

  // Compute transitions first (cheap, in-memory) then fan out broadcasts in
  // parallel. Sequential await per user caused the sweeper to exceed the
  // 2-second interval under NFR-CAP-1 load (300 users).
  const transitions: Array<{ userId: string; state: PresenceState }> = [];
  for (const userId of tracked) {
    const next = computeStateFor(userId);
    const previous = lastBroadcast.get(userId);
    if (previous === next) continue;
    if (next === 'offline') lastBroadcast.delete(userId);
    else lastBroadcast.set(userId, next);
    transitions.push({ userId, state: next });
  }

  await Promise.all(
    transitions.map(async ({ userId, state }) => {
      try {
        await broadcast(userId, state);
      } catch (err) {
        // A DB blip in the subscription query shouldn't crash the sweeper.
        // eslint-disable-next-line no-console
        console.error('[presence] broadcast failed', { userId, state, err });
      }
    }),
  );
};

const handle = setInterval(() => {
  void sweepOnce();
}, config.PRESENCE_SWEEP_INTERVAL_MS);
if (typeof handle.unref === 'function') handle.unref();

export const __stopSweeperForTests = (): void => {
  clearInterval(handle);
  lastBroadcast.clear();
};
