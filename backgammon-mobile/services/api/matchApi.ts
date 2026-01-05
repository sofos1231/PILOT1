import apiClient from './axiosInstance';
import { GameState, Move } from '../../types/game.types';

export const matchApi = {
  getMatch: (matchId: string) =>
    apiClient.get<{ success: boolean; match: any }>(`/matches/${matchId}`),

  setReady: (matchId: string) =>
    apiClient.post<{ success: boolean; both_ready: boolean; game_state?: GameState }>(
      `/matches/${matchId}/ready`
    ),

  rollDice: (matchId: string) =>
    apiClient.post<{ success: boolean; dice: any[]; legal_moves: Move[] }>(
      `/matches/${matchId}/roll`
    ),

  makeMove: (matchId: string, moves: Move[]) =>
    apiClient.post<{
      success: boolean;
      game_state: GameState;
      legal_moves: Move[];
      turn_complete: boolean;
      game_over: boolean;
      winner?: string;
    }>(`/matches/${matchId}/move`, { moves }),

  forfeit: (matchId: string) =>
    apiClient.post<{ success: boolean }>(`/matches/${matchId}/forfeit`),

  getHistory: (limit?: number) =>
    apiClient.get<{ success: boolean; matches: any[] }>('/matches/user/history', {
      params: { limit },
    }),
};
