import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { create } from 'zustand';
import type { MessageView, PresenceState } from '@agora/shared';
import { createWsClient, type WsClient } from '../lib/wsClient';
import { backfillAllConversations } from '../features/messages/backfill';
import { useLastSeenStore } from '../features/messages/lastSeen';

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
        // Invalidate only the affected conversation's history, not every
        // cached messages query. Wide invalidation was amplifying a single
        // received message into 5-10 refetches per active conversation.
        queryClient.invalidateQueries({
          queryKey: ['messages', payload.conversationType, payload.conversationId],
        });
      }
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    });
    const unsubscribeReopen = client.on('ws.reopen', () => {
      void backfillAllConversations(queryClient);
    });
    const unsubscribeUpdated = client.on('message.updated', (event) => {
      const payload = event.payload as MessageView | undefined;
      if (!payload) return;
      queryClient.invalidateQueries({
        queryKey: ['messages', payload.conversationType, payload.conversationId],
      });
    });
    const unsubscribeDeleted = client.on('message.deleted', (event) => {
      const payload = event.payload as
        | { conversationType: 'room' | 'dm'; conversationId: string }
        | undefined;
      if (!payload) return;
      queryClient.invalidateQueries({
        queryKey: ['messages', payload.conversationType, payload.conversationId],
      });
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
    const unsubscribeFriendRequest = client.on('friend.request_received', () => {
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] });
    });
    const unsubscribeInvitation = client.on('invitation.received', () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
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
      unsubscribeFriendRequest();
      unsubscribeInvitation();
      window.removeEventListener('pointermove', activityHandler);
      window.removeEventListener('keydown', activityHandler);
      window.removeEventListener('focus', activityHandler);
      client.close();
    };
  }, [enabled, client, queryClient]);

  return <WsContext.Provider value={enabled ? client : null}>{children}</WsContext.Provider>;
};

export const useWs = (): WsClient | null => useContext(WsContext);
