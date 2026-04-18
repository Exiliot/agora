import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { RegisterRequest, UserSelf } from '@agora/shared';
import { api } from '../../lib/apiClient';
import { ME_QUERY_KEY } from './useMe';

export const useRegister = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RegisterRequest) =>
      api.post<{ user: UserSelf }>('/auth/register', body),
    onSuccess: (data) => {
      qc.setQueryData(ME_QUERY_KEY, data.user);
    },
  });
};
