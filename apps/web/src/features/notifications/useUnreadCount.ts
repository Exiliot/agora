import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/apiClient';

export const useUnreadCount = () =>
  useQuery<{ count: number }>({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => api.get<{ count: number }>('/notifications/unread-count'),
    // Lightweight endpoint; refetch on window focus to reconcile after offline.
    refetchOnWindowFocus: true,
  });
