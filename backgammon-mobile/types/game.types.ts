export type Color = 'white' | 'black';

export interface Point {
  pieces: number;
  color: Color | null;
}

export interface Dice {
  value: number;
  used: boolean;
}

export interface GameState {
  board: Point[];
  bar: { white: number; black: number };
  off: { white: number; black: number };
  current_turn: Color;
  dice: Dice[];
  doubling_cube: {
    value: number;
    owner: Color | 'center';
  };
}

export interface Move {
  from: number;
  to: number;
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
  game_state: GameState | null;
  winner_id: string | null;
}
