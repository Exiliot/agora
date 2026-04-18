import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FriendRequestCreate, FriendRequestView, FriendshipView } from '@agora/shared';
import { api } from '../../lib/apiClient';

export const useFriends = () =>
  useQuery<FriendshipView[]>({
    queryKey: ['friends'],
    queryFn: async () => {
      const body = await api.get<{ friends: FriendshipView[] }>('/friends');
      return body.friends;
    },
  });

export const useIncomingRequests = () =>
  useQuery<FriendRequestView[]>({
    queryKey: ['friend-requests', 'incoming'],
    queryFn: async () => {
      const body = await api.get<{ requests: FriendRequestView[] }>(
        '/friend-requests?direction=incoming',
      );
      return body.requests;
    },
  });

export const useOutgoingRequests = () =>
  useQuery<FriendRequestView[]>({
    queryKey: ['friend-requests', 'outgoing'],
    queryFn: async () => {
      const body = await api.get<{ requests: FriendRequestView[] }>(
        '/friend-requests?direction=outgoing',
      );
      return body.requests;
    },
  });

export const useSendFriendRequest = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: FriendRequestCreate) => api.post('/friend-requests', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['friend-requests'] }),
  });
};

export const useAcceptFriendRequest = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/friend-requests/${id}/accept`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['friend-requests'] });
      qc.invalidateQueries({ queryKey: ['friends'] });
    },
  });
};

export const useRejectFriendRequest = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/friend-requests/${id}/reject`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['friend-requests'] }),
  });
};

export const useCancelFriendRequest = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/friend-requests/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['friend-requests'] }),
  });
};

export const useUnfriend = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (otherUserId: string) => api.delete(`/friendships/${otherUserId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['friends'] }),
  });
};

export const useSearchUsers = (query: string) =>
  useQuery<{ id: string; username: string }[]>({
    queryKey: ['users', 'search', query],
    queryFn: async () => {
      if (!query.trim()) return [];
      const body = await api.get<{ users: { id: string; username: string }[] }>(
        `/users/search?q=${encodeURIComponent(query)}`,
      );
      return body.users;
    },
    enabled: query.trim().length > 0,
    staleTime: 15_000,
  });

export const useBanUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (targetUserId: string) => api.post('/user-bans', { targetUserId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-bans'] });
      qc.invalidateQueries({ queryKey: ['friends'] });
      qc.invalidateQueries({ queryKey: ['friend-requests'] });
    },
  });
};

export const useUnbanUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (targetId: string) => api.delete(`/user-bans/${targetId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user-bans'] }),
  });
};

interface UserBanRow {
  target: { id: string; username: string };
  reason: string | null;
  createdAt: string;
}

export const useMyBans = () =>
  useQuery<UserBanRow[]>({
    queryKey: ['user-bans', 'outgoing'],
    queryFn: async () => {
      const body = await api.get<{ bans: UserBanRow[] }>('/user-bans?direction=outgoing');
      return body.bans;
    },
  });

export interface IncomingBanRow {
  banner: { id: string; username: string };
  reason: string | null;
  createdAt: string;
}

/** Bans placed against the current user. Used by DmView to freeze the
 *  composer when the counterparty has banned the caller. */
export const useIncomingBans = () =>
  useQuery<IncomingBanRow[]>({
    queryKey: ['user-bans', 'incoming'],
    queryFn: async () => {
      const body = await api.get<{ bans: IncomingBanRow[] }>('/user-bans?direction=incoming');
      return body.bans;
    },
  });
