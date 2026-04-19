import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateRoomRequest, RoomDetail } from '@agora/shared';
import { api } from '../../lib/apiClient';

export const useCreateRoom = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateRoomRequest) => api.post<RoomDetail>('/rooms', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rooms'] });
      // M11: the sidebar reads from useConversations, not useRooms. Without
      // this invalidation the new room stays absent from the sidebar until
      // another signal (first message, presence tick) happens to refresh it.
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
};
