import { create } from 'zustand';
import { GameState, Move, Color } from '../types/game.types';

interface MatchState {
  // Match data
  matchId: string | null;
  matchType: 'gold' | 'club';
  stakeAmount: number;
  myColor: Color | null;

  // Opponent
  opponent: {
    user_id: string;
    username: string;
  } | null;

  // Game state
  gameState: GameState | null;
  legalMoves: Move[];
  selectedPoint: number | null;

  // Status
  isMyTurn: boolean;
  isReady: boolean;
  opponentReady: boolean;
  matchStatus: 'waiting' | 'ready' | 'in_progress' | 'completed';

  // Actions
  setMatch: (data: {
    matchId: string;
    matchType: 'gold' | 'club';
    stakeAmount: number;
    myColor: Color;
    opponent: { user_id: string; username: string };
  }) => void;
  setGameState: (state: GameState) => void;
  setLegalMoves: (moves: Move[]) => void;
  setSelectedPoint: (point: number | null) => void;
  setReady: (ready: boolean) => void;
  setOpponentReady: (ready: boolean) => void;
  setMatchStatus: (status: 'waiting' | 'ready' | 'in_progress' | 'completed') => void;
  clearMatch: () => void;
}

export const useMatchStore = create<MatchState>((set, get) => ({
  matchId: null,
  matchType: 'gold',
  stakeAmount: 0,
  myColor: null,
  opponent: null,
  gameState: null,
  legalMoves: [],
  selectedPoint: null,
  isMyTurn: false,
  isReady: false,
  opponentReady: false,
  matchStatus: 'waiting',

  setMatch: (data) => set({
    matchId: data.matchId,
    matchType: data.matchType,
    stakeAmount: data.stakeAmount,
    myColor: data.myColor,
    opponent: data.opponent,
    matchStatus: 'ready',
  }),

  setGameState: (gameState) => {
    const myColor = get().myColor;
    set({
      gameState,
      isMyTurn: gameState.current_turn === myColor,
    });
  },

  setLegalMoves: (legalMoves) => set({ legalMoves }),

  setSelectedPoint: (selectedPoint) => set({ selectedPoint }),

  setReady: (isReady) => set({ isReady }),

  setOpponentReady: (opponentReady) => set({ opponentReady }),

  setMatchStatus: (matchStatus) => set({ matchStatus }),

  clearMatch: () => set({
    matchId: null,
    matchType: 'gold',
    stakeAmount: 0,
    myColor: null,
    opponent: null,
    gameState: null,
    legalMoves: [],
    selectedPoint: null,
    isMyTurn: false,
    isReady: false,
    opponentReady: false,
    matchStatus: 'waiting',
  }),
}));
