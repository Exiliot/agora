import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/apiClient';
import { ME_QUERY_KEY } from './useMe';

export const useSignOut = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<null>('/auth/sign-out'),
    onSuccess: () => {
      qc.setQueryData(ME_QUERY_KEY, null);
      qc.clear();
    },
  });
};
