import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SessionView } from '@agora/shared';
import { api } from '../../lib/apiClient';

export const useSessions = () =>
  useQuery<SessionView[]>({
    queryKey: ['sessions'],
    queryFn: async () => {
      const body = await api.get<{ sessions: SessionView[] }>('/sessions');
      return body.sessions;
    },
  });

export const useRevokeSession = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<null>(`/sessions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
};
