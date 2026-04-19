import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { PasswordChangeRequest } from '@agora/shared';
import { api } from '../../lib/apiClient';

/**
 * FR-AUTH-10: change the caller's password while signed in. Server revokes
 * every sibling session and responds 204. We invalidate `sessions` so the
 * active-sessions table updates immediately (the caller keeps their own).
 */
export const useChangePassword = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PasswordChangeRequest) =>
      api.post<void>('/auth/password-change', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
};
