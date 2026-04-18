import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateRoomRequest, RoomDetail } from '@agora/shared';
import { api } from '../../lib/apiClient';

export const useCreateRoom = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateRoomRequest) => api.post<RoomDetail>('/rooms', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
};
