import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/apiClient';

export const useOpenDm = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (otherUserId: string) =>
      api.post<{ id: string }>('/dm/open', { otherUserId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversations'] }),
  });
};
