export interface QueueEntry {
  queue_id: string;
  user_id: string;
  stake_amount: number;
  match_type: 'gold' | 'club';
  club_id: string | null;
  status: 'waiting' | 'matched' | 'cancelled' | 'expired';
  matched_with_user_id: string | null;
  match_id: string | null;
  created_at: Date;
  expires_at: Date;
  // Joined fields
  username?: string;
  level?: number;
  wins?: number;
}

export interface MatchmakingResult {
  matched: boolean;
  match_id?: string;
  opponent?: {
    user_id: string;
    username: string;
    level: number;
    wins: number;
  };
  queue_position?: number;
  estimated_wait?: number;
}
