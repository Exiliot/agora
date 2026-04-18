import { useQuery } from '@tanstack/react-query';
import type { RoomSummary } from '@agora/shared';
import { api } from '../../lib/apiClient';

export interface ConversationRoom extends RoomSummary {
  type: 'room';
  unreadCount: number;
  lastReadMessageId: string | null;
  preview: string | null;
}

export interface ConversationDm {
  type: 'dm';
  id: string;
  counterparty: { id: string; username: string };
  unreadCount: number;
  lastReadMessageId: string | null;
  preview: string | null;
}

interface ConversationsResponse {
  rooms: ConversationRoom[];
  dms: ConversationDm[];
}

export const useConversations = () =>
  useQuery<ConversationsResponse>({
    queryKey: ['conversations'],
    queryFn: () => api.get<ConversationsResponse>('/conversations'),
  });
