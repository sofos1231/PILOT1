import { GameState, Move } from './game.types';

// Events the server sends to clients
export interface ServerToClientEvents {
  // Connection
  authenticated: (data: { user_id: string; username: string }) => void;
  error: (data: { code: string; message: string }) => void;

  // Match events
  match_found: (data: {
    match_id: string;
    opponent: { user_id: string; username: string; avatar_url?: string };
    your_color: 'white' | 'black';
    stake_amount: number;
  }) => void;
  player_joined: (data: { match_id: string; user_id: string; username: string }) => void;
  player_ready_status: (data: { match_id: string; user_id: string; ready: boolean }) => void;
  match_starting: (data: { match_id: string; starts_in: number }) => void;
  match_started: (data: { match_id: string; game_state: GameState; your_color: string }) => void;
  turn_changed: (data: {
    match_id: string;
    current_turn: string;
    dice: { value: number; used: boolean }[];
    deadline?: string;
  }) => void;
  move_made: (data: {
    match_id: string;
    moves: Move[];
    game_state: GameState;
    by_user_id: string;
  }) => void;
  match_completed: (data: {
    match_id: string;
    winner_id: string;
    winner_username: string;
    result: {
      win_type: string;
      gold_won: number;
    };
  }) => void;
  opponent_disconnected: (data: { match_id: string; user_id: string; reconnect_deadline: string }) => void;
  opponent_reconnected: (data: { match_id: string; user_id: string }) => void;

  // Club events
  club_chat_message: (data: {
    club_id: string;
    message: {
      message_id: string;
      user_id: string;
      username: string;
      avatar_url?: string;
      content: string;
      timestamp: string;
    }
  }) => void;
  club_member_online: (data: { club_id: string; user_id: string; username: string }) => void;
  club_member_offline: (data: { club_id: string; user_id: string }) => void;
  club_table_created: (data: { club_id: string; table: any }) => void;
  club_table_started: (data: { club_id: string; table_id: string; match_id: string }) => void;
  club_chips_received: (data: {
    club_id: string;
    amount: number;
    new_balance: number;
    from_user: { user_id: string; username: string }
  }) => void;

  // Notifications
  notification: (data: {
    id: string;
    type: string;
    title: string;
    message: string;
    data?: any;
    timestamp: string;
  }) => void;

  // Gold updates
  gold_balance_updated: (data: { balance: number; change: number; reason: string }) => void;

  // Heartbeat
  pong: () => void;
}

// Events clients send to the server
export interface ClientToServerEvents {
  // Auth (sent automatically via handshake, but can re-auth)
  authenticate: (data: { token: string }) => void;

  // Match
  join_match: (data: { match_id: string }) => void;
  leave_match: (data: { match_id: string }) => void;
  player_ready: (data: { match_id: string }) => void;
  submit_moves: (data: { match_id: string; moves: Move[] }) => void;

  // Club
  join_club_room: (data: { club_id: string }) => void;
  leave_club_room: (data: { club_id: string }) => void;
  send_chat_message: (data: { club_id: string; content: string }) => void;

  // Heartbeat
  ping: () => void;
}

// Data stored on socket
export interface SocketData {
  userId: string;
  email: string;
  username: string;
}
