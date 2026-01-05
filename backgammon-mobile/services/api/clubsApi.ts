import apiClient from './axiosInstance';
import { Club, ClubMembership, ClubTable, ClubWithMembership } from '../../types/club.types';

export interface CreateClubData {
  name: string;
  description?: string;
  privacy?: 'public' | 'private';
  welcome_bonus?: number;
}

export const clubsApi = {
  // Search/discover clubs
  searchClubs: (params?: { search?: string; privacy?: string; limit?: number; offset?: number }) =>
    apiClient.get<{ success: boolean; clubs: Club[]; total: number }>('/clubs', { params }),

  // Get single club
  getClub: (clubId: string) =>
    apiClient.get<{ success: boolean; club: Club; membership: ClubMembership | null }>(`/clubs/${clubId}`),

  // Get user's clubs
  getMyClubs: () =>
    apiClient.get<{ success: boolean; clubs: ClubWithMembership[] }>('/clubs/user/my-clubs'),

  // Create club
  createClub: (data: CreateClubData) =>
    apiClient.post<{ success: boolean; club: Club }>('/clubs', data),

  // Join club
  joinClub: (clubId: string) =>
    apiClient.post<{ success: boolean; membership: ClubMembership }>(`/clubs/${clubId}/join`),

  // Leave club
  leaveClub: (clubId: string) =>
    apiClient.post<{ success: boolean }>(`/clubs/${clubId}/leave`),

  // Get members
  getMembers: (clubId: string, params?: { sort?: string; limit?: number }) =>
    apiClient.get<{ success: boolean; members: ClubMembership[]; total: number }>(`/clubs/${clubId}/members`, { params }),

  // Get chip balance
  getChipBalance: (clubId: string) =>
    apiClient.get<{ success: boolean; balance: number }>(`/clubs/${clubId}/chips/balance`),

  // Grant chips (admin only)
  grantChips: (clubId: string, userId: string, amount: number, reason?: string) =>
    apiClient.post<{ success: boolean; new_balance: number }>(`/clubs/${clubId}/chips/grant`, {
      user_id: userId,
      amount,
      reason,
    }),

  // Get tables
  getTables: (clubId: string) =>
    apiClient.get<{ success: boolean; tables: ClubTable[] }>(`/clubs/${clubId}/tables`),

  // Create table
  createTable: (clubId: string, stakeAmount: number) =>
    apiClient.post<{ success: boolean; table: ClubTable }>(`/clubs/${clubId}/tables`, {
      stake_amount: stakeAmount,
    }),

  // Get leaderboard
  getLeaderboard: (clubId: string, limit?: number) =>
    apiClient.get<{ success: boolean; leaderboard: any[] }>(`/clubs/${clubId}/leaderboard`, {
      params: { limit },
    }),
};
