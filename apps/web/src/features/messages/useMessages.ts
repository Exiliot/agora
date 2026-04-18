import { useInfiniteQuery } from '@tanstack/react-query';
import type { ConversationType, MessageView } from '@agora/shared';
import { api } from '../../lib/apiClient';

interface MessagesPage {
  messages: MessageView[];
  hasMore: boolean;
}

export const useMessages = (
  conversationType: ConversationType | null,
  conversationId: string | null,
) =>
  useInfiniteQuery<MessagesPage, Error>({
    queryKey: ['messages', conversationType, conversationId],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '50' });
      if (pageParam) params.set('before', pageParam as string);
      const url = `/conversations/${conversationType}/${conversationId}/messages?${params.toString()}`;
      const body = await api.get<{ messages: MessageView[] }>(url);
      const messages = body.messages ?? [];
      return {
        messages,
        hasMore: messages.length === 50,
      };
    },
    getNextPageParam: (last) => (last.hasMore ? last.messages.at(-1)?.id ?? null : null),
    enabled: Boolean(conversationType && conversationId),
    staleTime: 30_000,
  });
