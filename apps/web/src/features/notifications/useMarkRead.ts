import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/apiClient';

export const useMarkRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<void>(`/notifications/${id}/read`, undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });
};
