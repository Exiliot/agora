import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RoomBanView, RoomInvitationView } from '@agora/shared';
import { api } from '../../lib/apiClient';

export const useRoomBans = (roomId: string | null) =>
  useQuery<RoomBanView[]>({
    queryKey: ['rooms', 'bans', roomId],
    queryFn: async () => {
      const body = await api.get<{ bans: RoomBanView[] }>(`/rooms/${roomId}/bans`);
      return body.bans;
    },
    enabled: Boolean(roomId),
  });

export const useMyInvitations = () =>
  useQuery<RoomInvitationView[]>({
    queryKey: ['invitations'],
    queryFn: async () => {
      const body = await api.get<{ invitations: RoomInvitationView[] }>('/invitations');
      return body.invitations;
    },
  });

const invalidate = (qc: ReturnType<typeof useQueryClient>, roomId: string | null) => {
  qc.invalidateQueries({ queryKey: ['rooms'] });
  qc.invalidateQueries({ queryKey: ['conversations'] });
  if (roomId) qc.invalidateQueries({ queryKey: ['rooms', 'detail', roomId] });
};

export const useRemoveMember = (roomId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.delete(`/rooms/${roomId}/members/${userId}`),
    onSuccess: () => invalidate(qc, roomId),
  });
};

export const usePromoteAdmin = (roomId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.post(`/rooms/${roomId}/admins`, { userId }),
    onSuccess: () => invalidate(qc, roomId),
  });
};

export const useDemoteAdmin = (roomId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.delete(`/rooms/${roomId}/admins/${userId}`),
    onSuccess: () => invalidate(qc, roomId),
  });
};

export const useUnbanFromRoom = (roomId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.delete(`/rooms/${roomId}/bans/${userId}`),
    onSuccess: () => invalidate(qc, roomId),
  });
};

export const useInviteToRoom = (roomId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (targetUsername: string) =>
      api.post(`/rooms/${roomId}/invitations`, { targetUsername }),
    onSuccess: () => invalidate(qc, roomId),
  });
};

export const useDeleteRoom = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (roomId: string) => api.delete(`/rooms/${roomId}`),
    onSuccess: () => invalidate(qc, null),
  });
};

export const useAcceptInvitation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<{ roomId: string }>(`/invitations/${id}/accept`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invitations'] });
      qc.invalidateQueries({ queryKey: ['rooms'] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
};

export const useRejectInvitation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/invitations/${id}/reject`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invitations'] }),
  });
};
