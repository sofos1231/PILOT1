import apiClient from './axiosInstance';

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  username: string;
  avatar_url: string | null;
  level: number;
  wins: number;
  losses: number;
  total_matches: number;
  win_rate: number;
  gold_balance: number;
}

export const leaderboardApi = {
  getGlobal: (sortBy?: string, limit?: number, offset?: number) =>
    apiClient.get<{
      success: boolean;
      leaderboard: LeaderboardEntry[];
      total: number;
    }>('/leaderboard', {
      params: { sort_by: sortBy, limit, offset },
    }),

  getMyRank: () =>
    apiClient.get<{ success: boolean; rank: number | null }>('/leaderboard/me'),

  getAroundMe: (range?: number) =>
    apiClient.get<{
      success: boolean;
      leaderboard: LeaderboardEntry[];
      my_rank: number;
    }>('/leaderboard/around-me', { params: { range } }),
};
