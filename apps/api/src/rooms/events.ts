/**
 * Typed helpers for publishing rooms domain events to the in-process bus.
 *
 * Event names match docs/ws-protocol.md §4; the payload shapes are the wire
 * shapes consumed by the web client.
 */

import { bus } from '../bus/bus.js';
import { roomTopic, userTopic } from '../bus/topics.js';

interface MinimalUser {
  id: string;
  username: string;
}

export const publishRoomMemberJoined = (roomId: string, user: MinimalUser): void => {
  bus.publish(roomTopic(roomId), {
    type: 'room.member_joined',
    payload: { roomId, user },
  });
};

export const publishRoomMemberLeft = (roomId: string, userId: string): void => {
  bus.publish(roomTopic(roomId), {
    type: 'room.member_left',
    payload: { roomId, userId },
  });
};

export const publishRoomMemberRemoved = (
  roomId: string,
  targetUserId: string,
  byUserId: string,
): void => {
  bus.publish(roomTopic(roomId), {
    type: 'room.member_removed',
    payload: { roomId, userId: targetUserId, byUserId },
  });
};

export const publishRoomAdminAdded = (roomId: string, userId: string): void => {
  bus.publish(roomTopic(roomId), {
    type: 'room.admin_added',
    payload: { roomId, userId },
  });
};

export const publishRoomAdminRemoved = (roomId: string, userId: string): void => {
  bus.publish(roomTopic(roomId), {
    type: 'room.admin_removed',
    payload: { roomId, userId },
  });
};

export const publishRoomDeleted = (roomId: string): void => {
  bus.publish(roomTopic(roomId), {
    type: 'room.deleted',
    payload: { roomId },
  });
};

export const publishRoomAccessLost = (
  userId: string,
  roomId: string,
  reason: 'removed' | 'banned' | 'room_deleted',
): void => {
  bus.publish(userTopic(userId), {
    type: 'room.access_lost',
    payload: { roomId, reason },
  });
};

export interface InvitationReceivedPayload {
  id: string;
  roomId: string;
  roomName: string;
  inviter: MinimalUser | null;
}

export const publishInvitationReceived = (
  targetUserId: string,
  invitation: InvitationReceivedPayload,
): void => {
  bus.publish(userTopic(targetUserId), {
    type: 'invitation.received',
    payload: invitation,
  });
};
