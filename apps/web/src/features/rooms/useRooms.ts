import { useQuery } from '@tanstack/react-query';
import type { RoomSummary } from '@agora/shared';
import { api } from '../../lib/apiClient';

export const useMyRooms = () =>
  useQuery<RoomSummary[]>({
    queryKey: ['rooms', 'mine'],
    queryFn: async () => {
      const body = await api.get<{ rooms: RoomSummary[] }>('/rooms/mine');
      return body.rooms;
    },
  });

export const usePublicRooms = (search: string) =>
  useQuery<RoomSummary[]>({
    queryKey: ['rooms', 'public', search],
    queryFn: async () => {
      const params = new URLSearchParams({ visibility: 'public' });
      if (search.trim()) params.set('q', search.trim());
      const body = await api.get<{ rooms: RoomSummary[] }>(`/rooms?${params.toString()}`);
      return body.rooms;
    },
    staleTime: 15_000,
  });
