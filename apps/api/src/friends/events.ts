/**
 * Typed publishers for friends-domain events on the in-process bus.
 *
 * Event names and payload shapes match `docs/ws-protocol.md` §4 and the zod
 * schemas in `@agora/shared/ws`. Each helper targets the relevant `user:<id>`
 * topic so per-user fan-out stays in the WS dispatcher.
 */

import { bus } from '../bus/bus.js';
import { userTopic } from '../bus/topics.js';

interface MinimalUser {
  id: string;
  username: string;
}

export interface FriendRequestReceivedPayload {
  id: string;
  sender: MinimalUser;
  note: string | null;
}

export const publishFriendRequestReceived = (
  recipientId: string,
  payload: FriendRequestReceivedPayload,
): void => {
  bus.publish(userTopic(recipientId), {
    type: 'friend.request_received',
    payload,
  });
};

export const publishFriendRequestCancelled = (recipientId: string, requestId: string): void => {
  bus.publish(userTopic(recipientId), {
    type: 'friend.request_cancelled',
    payload: { requestId },
  });
};

export const publishFriendshipCreated = (targetUserId: string, otherUserId: string): void => {
  bus.publish(userTopic(targetUserId), {
    type: 'friendship.created',
    payload: { userId: otherUserId },
  });
};

export const publishFriendshipRemoved = (targetUserId: string, otherUserId: string): void => {
  bus.publish(userTopic(targetUserId), {
    type: 'friendship.removed',
    payload: { userId: otherUserId },
  });
};

export const publishUserBanCreated = (
  targetUserId: string,
  bannerId: string,
  bannedId: string,
): void => {
  bus.publish(userTopic(targetUserId), {
    type: 'user_ban.created',
    payload: { bannerId, targetId: bannedId },
  });
};

export const publishUserBanRemoved = (
  targetUserId: string,
  bannerId: string,
  bannedId: string,
): void => {
  bus.publish(userTopic(targetUserId), {
    type: 'user_ban.removed',
    payload: { bannerId, targetId: bannedId },
  });
};
