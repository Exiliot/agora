import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/apiClient';

/**
 * FR-AUTH-13: permanently delete the caller's account. Server returns 204
 * and clears the session cookie; caller is responsible for navigating away.
 */
export const useDeleteAccount = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete<void>('/users/me'),
    onSuccess: () => {
      qc.clear();
    },
  });
};
