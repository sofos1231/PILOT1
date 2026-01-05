import apiClient from './axiosInstance';

export const matchmakingApi = {
  joinQueue: (stakeAmount: number, matchType?: 'gold' | 'club', clubId?: string) =>
    apiClient.post<{
      success: boolean;
      matched: boolean;
      match_id?: string;
      opponent?: { user_id: string; username: string; level: number; wins: number };
      queue_position?: number;
      estimated_wait?: number;
    }>('/matchmaking/join', {
      stake_amount: stakeAmount,
      match_type: matchType,
      club_id: clubId,
    }),

  leaveQueue: () =>
    apiClient.post<{ success: boolean; cancelled: boolean }>('/matchmaking/leave'),

  getStatus: () =>
    apiClient.get<{
      success: boolean;
      in_queue: boolean;
      position?: number;
      stake_amount?: number;
    }>('/matchmaking/status'),
};
