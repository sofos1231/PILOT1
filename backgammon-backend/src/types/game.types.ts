export type Color = 'white' | 'black';

export interface Point {
  pieces: number;
  color: Color | null;
}

export interface Dice {
  value: number;
  used: boolean;
}

export interface DoublingCube {
  value: number;
  owner: Color | 'center';
}

export interface GameState {
  board: Point[]; // 24 points (0-23)
  bar: { white: number; black: number };
  off: { white: number; black: number };
  current_turn: Color;
  dice: Dice[];
  doubling_cube: DoublingCube;
  move_deadline?: string; // ISO timestamp
}

export interface Move {
  from: number; // 0-23 for board, -1 for bar
  to: number;   // 0-23 for board, -1 for bearing off
  die_value: number;
}

export interface Match {
  match_id: string;
  match_type: 'gold' | 'club';
  status: 'waiting' | 'ready' | 'in_progress' | 'completed' | 'abandoned';
  player_white_id: string | null;
  player_black_id: string | null;
  player_white_ready: boolean;
  player_black_ready: boolean;
  stake_amount: number;
  club_id: string | null;
  doubling_cube_enabled: boolean;
  game_state: GameState | null;
  winner_id: string | null;
  final_cube_value: number;
  created_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
  last_move_at: Date | null;
}

export interface CreateMatchData {
  match_type: 'gold' | 'club';
  stake_amount: number;
  club_id?: string;
  doubling_cube_enabled?: boolean;
}

export type WinType = 'normal' | 'gammon' | 'backgammon';

export interface GameResult {
  winner: Color;
  win_type: WinType;
  multiplier: number; // 1 for normal, 2 for gammon, 3 for backgammon
}
