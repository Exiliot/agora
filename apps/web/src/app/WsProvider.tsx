import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createWsClient, type WsClient } from '../lib/wsClient';

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

    const unsubscribeNewMessage = client.on('message.new', () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    });
    const unsubscribeUpdated = client.on('message.updated', () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    });
    const unsubscribeDeleted = client.on('message.deleted', () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
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

    const activityHandler = () => client.send({ type: 'heartbeat', payload: {} });
    window.addEventListener('pointermove', activityHandler);
    window.addEventListener('keydown', activityHandler);
    window.addEventListener('focus', activityHandler);

    return () => {
      unsubscribeNewMessage();
      unsubscribeUpdated();
      unsubscribeDeleted();
      unsubscribeUnread();
      unsubscribeRoomChanges();
      unsubscribeAccessLost();
      window.removeEventListener('pointermove', activityHandler);
      window.removeEventListener('keydown', activityHandler);
      window.removeEventListener('focus', activityHandler);
      client.close();
    };
  }, [enabled, client, queryClient]);

  return <WsContext.Provider value={enabled ? client : null}>{children}</WsContext.Provider>;
};

export const useWs = (): WsClient | null => useContext(WsContext);
