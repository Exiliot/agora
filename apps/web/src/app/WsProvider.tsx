import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { create } from 'zustand';
import type {
  MessageView,
  NotificationView,
  PresenceState,
  ServerToClientEvent,
} from '@agora/shared';
import { createWsClient, type WsClient } from '../lib/wsClient';
import { backfillAllConversations } from '../features/messages/backfill';
import { useLastSeenStore } from '../features/messages/lastSeen';
import type { MessagesPage } from '../features/messages/useMessages';
import { maybeFireNative } from '../features/notifications/native';
import type {
  NotificationsInfiniteData,
  NotificationsPage,
} from '../features/notifications/useNotifications';

// Compile-time exhaustive check: if a new ServerToClientEvent['type'] is
// added to @agora/shared without a case below, tsc will flag the default
// branch as assigning a non-`never` value to a `never`-typed parameter.
// This is the handler-coverage contract from ADR-0009; the function body
// is never called, only type-checked.
const assertNever = (value: never): never => value;
const assertEventTypeHandled = (event: ServerToClientEvent): void => {
  switch (event.type) {
    case 'message.new':
    case 'message.updated':
    case 'message.deleted':
    case 'unread.updated':
    case 'room.member_joined':
    case 'room.member_left':
    case 'room.member_removed':
    case 'room.access_lost':
    case 'room.deleted':
    case 'room.admin_added':
    case 'room.admin_removed':
    case 'presence.update':
    case 'presence.snapshot':
    case 'friend.request_received':
    case 'friend.request_cancelled':
    case 'friendship.created':
    case 'friendship.removed':
    case 'user_ban.created':
    case 'user_ban.removed':
    case 'invitation.received':
    case 'notification.created':
    case 'notification.read':
    case 'notification.read_all':
      return;
    default:
      assertNever(event);
  }
};
void assertEventTypeHandled;

type MessagesInfiniteData = InfiniteData<MessagesPage, string | null>;

interface PresenceStore {
  states: Map<string, PresenceState>;
  setOne: (userId: string, state: PresenceState) => void;
  bulk: (entries: { userId: string; state: PresenceState }[]) => void;
}

export const usePresenceStore = create<PresenceStore>((set) => ({
  states: new Map(),
  setOne: (userId, state) =>
    set((prev) => {
      const next = new Map(prev.states);
      next.set(userId, state);
      return { states: next };
    }),
  bulk: (entries) =>
    set((prev) => {
      const next = new Map(prev.states);
      for (const entry of entries) next.set(entry.userId, entry.state);
      return { states: next };
    }),
}));

export const usePresenceOf = (userId: string | undefined): PresenceState =>
  usePresenceStore((s) => (userId ? s.states.get(userId) ?? 'offline' : 'offline'));

const WsContext = createContext<WsClient | null>(null);

interface WsProviderProps {
  enabled: boolean;
  children: ReactNode;
}

/**
 * Lazily starts a WS connection once the user is authenticated (`enabled=true`).
 * Incoming events update the TanStack Query cache so feature hooks pick up
 * real-time changes transparently.
 */
export const WsProvider = ({ enabled, children }: WsProviderProps) => {
  const queryClient = useQueryClient();
  const client = useMemo(() => createWsClient(), []);

  useEffect(() => {
    if (!enabled) return;
    client.connect();

    const unsubscribeNewMessage = client.on('message.new', (event) => {
      const payload = event.payload as MessageView | undefined;
      if (payload) {
        useLastSeenStore
          .getState()
          .note(payload.conversationType, payload.conversationId, payload.id);
        // Prepend into page 0 directly. Invalidating an infinite query here
        // was unreliable: each page refetches with its original `before`
        // cursor, and in a long history the first page's cursor moves while
        // later pages stay pinned – the new message could be missed or
        // dropped in the cursor realignment. setQueryData is deterministic,
        // idempotent (dedup by id), and avoids a pointless server round-trip.
        queryClient.setQueryData<MessagesInfiniteData>(
          ['messages', payload.conversationType, payload.conversationId],
          (old) => {
            if (!old || old.pages.length === 0) return old;
            const [first, ...rest] = old.pages;
            if (!first) return old;
            if (first.messages.some((m) => m.id === payload.id)) return old;
            return {
              ...old,
              pages: [{ ...first, messages: [payload, ...first.messages] }, ...rest],
            };
          },
        );
      }
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    });
    const unsubscribeReopen = client.on('ws.reopen', () => {
      void backfillAllConversations(queryClient);
    });
    const unsubscribeUpdated = client.on('message.updated', (event) => {
      const payload = event.payload as MessageView | undefined;
      if (!payload) return;
      queryClient.setQueryData<MessagesInfiniteData>(
        ['messages', payload.conversationType, payload.conversationId],
        (old) => {
          if (!old) return old;
          let touched = false;
          const pages = old.pages.map((page) => {
            const idx = page.messages.findIndex((m) => m.id === payload.id);
            if (idx < 0) return page;
            touched = true;
            const next = page.messages.slice();
            next[idx] = payload;
            return { ...page, messages: next };
          });
          return touched ? { ...old, pages } : old;
        },
      );
    });
    const unsubscribeDeleted = client.on('message.deleted', (event) => {
      const payload = event.payload as
        | { id: string; conversationType: 'room' | 'dm'; conversationId: string }
        | undefined;
      if (!payload) return;
      const deletedAt = new Date().toISOString();
      queryClient.setQueryData<MessagesInfiniteData>(
        ['messages', payload.conversationType, payload.conversationId],
        (old) => {
          if (!old) return old;
          let touched = false;
          const pages = old.pages.map((page) => {
            const idx = page.messages.findIndex((m) => m.id === payload.id);
            if (idx < 0) return page;
            touched = true;
            const existing = page.messages[idx];
            if (!existing) return page;
            const next = page.messages.slice();
            next[idx] = { ...existing, body: '', deletedAt };
            return { ...page, messages: next };
          });
          return touched ? { ...old, pages } : old;
        },
      );
    });
    const unsubscribeUnread = client.on('unread.updated', () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    });
    const unsubscribeRoomChanges = client.on('room.member_joined', () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    });
    const unsubscribeAccessLost = client.on('room.access_lost', () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    });

    const unsubscribePresence = client.on('presence.update', (event) => {
      const payload = event.payload as { userId: string; state: PresenceState } | undefined;
      if (payload) usePresenceStore.getState().setOne(payload.userId, payload.state);
    });
    const unsubscribeSnapshot = client.on('presence.snapshot', (event) => {
      const payload = event.payload as
        | { entries: { userId: string; state: PresenceState }[] }
        | undefined;
      if (payload?.entries) usePresenceStore.getState().bulk(payload.entries);
    });
    const unsubscribeFriendship = client.on('friendship.created', () => {
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] });
    });
    const unsubFriendshipRemoved = client.on('friendship.removed', () => {
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    });
    const unsubscribeFriendRequest = client.on('friend.request_received', () => {
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] });
    });
    const unsubFriendRequestCancelled = client.on('friend.request_cancelled', () => {
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] });
    });
    const unsubUserBanCreated = client.on('user_ban.created', () => {
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['user-bans'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    });
    const unsubUserBanRemoved = client.on('user_ban.removed', () => {
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['user-bans'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    });
    const unsubRoomAdminAdded = client.on('room.admin_added', (event) => {
      const roomId = event.payload.roomId;
      queryClient.invalidateQueries({ queryKey: ['rooms', 'detail', roomId] });
    });
    const unsubRoomAdminRemoved = client.on('room.admin_removed', (event) => {
      const roomId = event.payload.roomId;
      queryClient.invalidateQueries({ queryKey: ['rooms', 'detail', roomId] });
    });
    const unsubRoomMemberLeft = client.on('room.member_left', (event) => {
      const roomId = event.payload.roomId;
      queryClient.invalidateQueries({ queryKey: ['rooms', 'detail', roomId] });
    });
    // room.access_lost already handles the "it was you" case (sidebar +
    // conversation list), so this handler only needs to refresh the room
    // detail pane for observers still in the room.
    const unsubRoomMemberRemoved = client.on('room.member_removed', (event) => {
      const roomId = event.payload.roomId;
      queryClient.invalidateQueries({ queryKey: ['rooms', 'detail', roomId] });
    });
    const unsubRoomDeleted = client.on('room.deleted', () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    });
    const unsubscribeInvitation = client.on('invitation.received', () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
    });

    const unsubNotificationCreated = client.on('notification.created', (event) => {
      const payload = event.payload as NotificationView | undefined;
      if (!payload) return;
      queryClient.setQueryData<NotificationsInfiniteData>(['notifications'], (old) => {
        if (!old) return old;
        const [first, ...rest] = old.pages;
        if (!first) return old;
        // collapse: if a row with the same id or (kind, subjectId, unread) exists
        // in page 0, update it in place; otherwise prepend.
        const sameSubjectUnreadIdx = first.notifications.findIndex(
          (n) =>
            n.id === payload.id ||
            (n.readAt === null &&
              n.kind === payload.kind &&
              n.subjectId === payload.subjectId),
        );
        const nextFirst: NotificationsPage =
          sameSubjectUnreadIdx >= 0
            ? {
                notifications: first.notifications.map((n, idx) =>
                  idx === sameSubjectUnreadIdx ? payload : n,
                ),
              }
            : { notifications: [payload, ...first.notifications] };
        return { ...old, pages: [nextFirst, ...rest] };
      });
      // Only bump the unread counter if this is actually a NEW unread row, not
      // a collapse update of an existing one. The server's aggregate_count goes
      // up but unread-count (distinct rows) stays the same. The cheapest
      // reconciliation is to invalidate and let the scalar endpoint re-fetch.
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
      maybeFireNative(payload);
    });

    const unsubNotificationRead = client.on('notification.read', (event) => {
      const payload = event.payload as { id: string } | undefined;
      if (!payload) return;
      const nowIso = new Date().toISOString();
      queryClient.setQueryData<NotificationsInfiniteData>(['notifications'], (old) => {
        if (!old) return old;
        const pages = old.pages.map((p) => ({
          notifications: p.notifications.map((n) =>
            n.id === payload.id && n.readAt === null ? { ...n, readAt: nowIso } : n,
          ),
        }));
        return { ...old, pages };
      });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    });

    const unsubNotificationReadAll = client.on('notification.read_all', () => {
      const nowIso = new Date().toISOString();
      queryClient.setQueryData<NotificationsInfiniteData>(['notifications'], (old) => {
        if (!old) return old;
        const pages = old.pages.map((p) => ({
          notifications: p.notifications.map((n) =>
            n.readAt ? n : { ...n, readAt: nowIso },
          ),
        }));
        return { ...old, pages };
      });
      queryClient.setQueryData<{ count: number }>(['notifications', 'unread-count'], { count: 0 });
    });

    const activityHandler = () => client.send({ type: 'heartbeat', payload: {} });
    window.addEventListener('pointermove', activityHandler);
    window.addEventListener('keydown', activityHandler);
    window.addEventListener('focus', activityHandler);

    return () => {
      unsubscribeNewMessage();
      unsubscribeReopen();
      unsubscribeUpdated();
      unsubscribeDeleted();
      unsubscribeUnread();
      unsubscribeRoomChanges();
      unsubscribeAccessLost();
      unsubscribePresence();
      unsubscribeSnapshot();
      unsubscribeFriendship();
      unsubFriendshipRemoved();
      unsubscribeFriendRequest();
      unsubFriendRequestCancelled();
      unsubUserBanCreated();
      unsubUserBanRemoved();
      unsubRoomAdminAdded();
      unsubRoomAdminRemoved();
      unsubRoomMemberLeft();
      unsubRoomMemberRemoved();
      unsubRoomDeleted();
      unsubscribeInvitation();
      unsubNotificationCreated();
      unsubNotificationRead();
      unsubNotificationReadAll();
      window.removeEventListener('pointermove', activityHandler);
      window.removeEventListener('keydown', activityHandler);
      window.removeEventListener('focus', activityHandler);
      client.close();
    };
  }, [enabled, client, queryClient]);

  return <WsContext.Provider value={enabled ? client : null}>{children}</WsContext.Provider>;
};

export const useWs = (): WsClient | null => useContext(WsContext);
