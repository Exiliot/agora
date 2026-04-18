import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { SignInRequest, UserSelf } from '@agora/shared';
import { api } from '../../lib/apiClient';
import { ME_QUERY_KEY } from './useMe';

export const useSignIn = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SignInRequest) =>
      api.post<{ user: UserSelf }>('/auth/sign-in', body),
    onSuccess: (data) => {
      qc.setQueryData(ME_QUERY_KEY, data.user);
    },
  });
};
