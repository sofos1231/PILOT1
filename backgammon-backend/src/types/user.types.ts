export interface User {
  user_id: string;
  email: string;
  username: string;
  password_hash: string | null;
  avatar_url: string | null;
  country: string | null;
  gold_balance: number;
  level: number;
  xp: number;
  google_id: string | null;
  apple_id: string | null;
  total_matches: number;
  wins: number;
  losses: number;
  total_gold_earned: number;
  total_gold_spent: number;
  is_active: boolean;
  is_banned: boolean;
  email_verified: boolean;
  last_daily_bonus_claim: Date | null;
  created_at: Date;
  updated_at: Date;
  last_login: Date | null;
}

export interface CreateUserData {
  email: string;
  username: string;
  password_hash?: string;
  avatar_url?: string;
  country?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  username: string;
  password: string;
  avatar_url?: string;
  country: string;
  age_confirmed: boolean;
}

export interface SafeUser extends Omit<User, 'password_hash'> {}
