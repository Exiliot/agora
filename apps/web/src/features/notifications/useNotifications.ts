import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query';
import type { NotificationView } from '@agora/shared';
import { api } from '../../lib/apiClient';

export interface NotificationsPage {
  notifications: NotificationView[];
}

export type NotificationsInfiniteData = InfiniteData<NotificationsPage, string | null>;

export const useNotifications = () =>
  useInfiniteQuery<NotificationsPage, Error, NotificationsInfiniteData, ['notifications'], string | null>({
    queryKey: ['notifications'],
    queryFn: ({ pageParam }) =>
      api.get<NotificationsPage>(
        pageParam ? `/notifications?before=${pageParam}` : '/notifications',
      ),
    initialPageParam: null,
    getNextPageParam: (last) =>
      last.notifications.length === 0
        ? null
        : last.notifications[last.notifications.length - 1]?.id ?? null,
  });
