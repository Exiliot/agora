import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/apiClient';

export const useMarkAllRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<void>(`/notifications/read-all`, undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });
};
