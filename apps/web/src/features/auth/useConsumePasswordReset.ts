import { useMutation } from '@tanstack/react-query';
import type { PasswordResetConsume } from '@agora/shared';
import { api } from '../../lib/apiClient';

/**
 * Step 2 of the forgot-password flow. Consumes the token from the email
 * link and sets a new password. Server also revokes every active session
 * for that user so a prior compromise is invalidated.
 */
export const useConsumePasswordReset = () =>
  useMutation({
    mutationFn: (body: PasswordResetConsume) =>
      api.post<void>('/auth/password-reset/consume', body),
  });
