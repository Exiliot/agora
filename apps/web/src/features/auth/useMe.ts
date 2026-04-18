import { useQuery } from '@tanstack/react-query';
import type { UserSelf } from '@agora/shared';
import { ApiError, api } from '../../lib/apiClient';

interface MeResponse {
  user: UserSelf;
}

export const ME_QUERY_KEY = ['me'] as const;

export const useMe = () =>
  useQuery<UserSelf | null>({
    queryKey: ME_QUERY_KEY,
    queryFn: async () => {
      try {
        const body = await api.get<MeResponse>('/auth/me');
        return body.user;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: 60_000,
    retry: false,
  });
