export interface Club {
  club_id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  owner_id: string;
  privacy: 'public' | 'private';
  welcome_bonus: number;
  member_count: number;
  total_chips_in_circulation: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ClubMembership {
  membership_id: string;
  club_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  chip_balance: number;
  matches_played: number;
  matches_won: number;
  joined_at: Date;
  // Joined fields from users table
  username?: string;
  avatar_url?: string;
  level?: number;
}

export interface CreateClubData {
  name: string;
  description?: string;
  logo_url?: string;
  privacy?: 'public' | 'private';
  welcome_bonus?: number;
}

export interface ClubTable {
  table_id: string;
  club_id: string;
  creator_user_id: string;
  stake_amount: number;
  privacy: 'public' | 'private';
  status: 'waiting' | 'started' | 'cancelled';
  match_id: string | null;
  created_at: Date;
  // Joined fields
  creator_username?: string;
}

export interface ClubJoinRequest {
  request_id: string;
  club_id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: Date;
  // Joined fields
  username?: string;
  avatar_url?: string;
}

export interface ChipTransaction {
  transaction_id: string;
  club_id: string;
  type: 'welcome_bonus' | 'grant' | 'match_win' | 'match_loss' | 'admin_adjust';
  from_user_id: string | null;
  to_user_id: string;
  amount: number;
  balance_after: number;
  reason: string | null;
  created_at: Date;
}
