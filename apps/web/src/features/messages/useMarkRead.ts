import { useEffect, useRef } from 'react';
import type { ConversationType } from '@agora/shared';
import { useWs } from '../../app/WsProvider';

interface UseMarkReadArgs {
  conversationType: ConversationType;
  conversationId: string;
  latestMessageId: string | undefined;
  /** True when the user has the conversation focused and is near the bottom. */
  active: boolean;
}

const THROTTLE_MS = 1_500;

/**
 * Fire a mark.read WS event for the active conversation when a new latest
 * message is visible. Deliberately fire-and-forget and throttled – the
 * server resets the unread counter on receipt, but if a burst of messages
 * arrives we only need the last id to reconcile.
 */
export const useMarkRead = ({
  conversationType,
  conversationId,
  latestMessageId,
  active,
}: UseMarkReadArgs): void => {
  const ws = useWs();
  const lastSentRef = useRef<string | null>(null);
  const lastSentAtRef = useRef<number>(0);

  useEffect(() => {
    if (!ws || !active || !latestMessageId) return;
    if (lastSentRef.current === latestMessageId) return;
    const now = Date.now();
    const gap = now - lastSentAtRef.current;
    const send = () => {
      ws.send({
        type: 'mark.read',
        payload: {
          conversationType,
          conversationId,
          messageId: latestMessageId,
        },
      });
      lastSentRef.current = latestMessageId;
      lastSentAtRef.current = Date.now();
    };
    if (gap >= THROTTLE_MS) {
      send();
      return;
    }
    const handle = setTimeout(send, THROTTLE_MS - gap);
    return () => clearTimeout(handle);
  }, [ws, active, latestMessageId, conversationType, conversationId]);
};
