import { useMutation } from '@tanstack/react-query';
import type { PasswordResetRequest } from '@agora/shared';
import { api } from '../../lib/apiClient';

/**
 * Step 1 of the forgot-password flow. Always resolves on the server side
 * for any well-formed email so an attacker can't enumerate registered
 * addresses; the UI mirrors that by showing the same confirmation either way.
 */
export const useRequestPasswordReset = () =>
  useMutation({
    mutationFn: (body: PasswordResetRequest) =>
      api.post<void>('/auth/password-reset/request', body),
  });
