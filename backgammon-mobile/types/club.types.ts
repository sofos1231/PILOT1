export interface Club {
  club_id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  owner_id: string;
  privacy: 'public' | 'private';
  welcome_bonus: number;
  member_count: number;
  is_active: boolean;
}

export interface ClubMembership {
  membership_id: string;
  club_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  chip_balance: number;
  username?: string;
  avatar_url?: string;
}

export interface ClubTable {
  table_id: string;
  club_id: string;
  creator_user_id: string;
  creator_username?: string;
  stake_amount: number;
  status: 'waiting' | 'started';
}

export interface ClubWithMembership extends Club {
  chip_balance: number;
  role: string;
}
