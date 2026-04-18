import { useQuery } from '@tanstack/react-query';
import type { RoomDetail, RoomRole } from '@agora/shared';
import { api } from '../../lib/apiClient';

interface RoomDetailWithRole extends RoomDetail {
  myRole: RoomRole | null;
}

export const useRoom = (roomId: string | null) =>
  useQuery<RoomDetailWithRole>({
    queryKey: ['rooms', 'detail', roomId],
    queryFn: () => api.get<RoomDetailWithRole>(`/rooms/${roomId}`),
    enabled: Boolean(roomId),
  });
