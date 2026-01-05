-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    avatar_url TEXT,
    country VARCHAR(3),
    gold_balance INTEGER DEFAULT 10000,
    level INTEGER DEFAULT 1,
    xp INTEGER DEFAULT 0,
    google_id VARCHAR(255),
    apple_id VARCHAR(255),
    total_matches INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    total_gold_earned INTEGER DEFAULT 10000,
    total_gold_spent INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    is_banned BOOLEAN DEFAULT FALSE,
    email_verified BOOLEAN DEFAULT FALSE,
    last_daily_bonus_claim TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP
);

-- Refresh tokens table
CREATE TABLE refresh_tokens (
    token_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Gold transactions table
CREATE TABLE gold_transactions (
    transaction_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    description TEXT,
    payment_intent_id VARCHAR(255),
    amount_usd DECIMAL(10, 2),
    related_match_id UUID,
    related_club_id UUID,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Matches table
CREATE TABLE matches (
    match_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_type VARCHAR(20) NOT NULL CHECK (match_type IN ('gold', 'club')),
    status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'ready', 'in_progress', 'completed', 'abandoned')),
    player_white_id UUID REFERENCES users(user_id),
    player_black_id UUID REFERENCES users(user_id),
    player_white_ready BOOLEAN DEFAULT FALSE,
    player_black_ready BOOLEAN DEFAULT FALSE,
    stake_amount INTEGER NOT NULL,
    club_id UUID,
    doubling_cube_enabled BOOLEAN DEFAULT TRUE,
    game_state JSONB,
    winner_id UUID REFERENCES users(user_id),
    final_cube_value INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    last_move_at TIMESTAMP
);

-- Clubs table
CREATE TABLE clubs (
    club_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    logo_url TEXT,
    owner_id UUID REFERENCES users(user_id),
    privacy VARCHAR(20) DEFAULT 'public' CHECK (privacy IN ('public', 'private')),
    welcome_bonus INTEGER DEFAULT 0,
    member_count INTEGER DEFAULT 1,
    total_chips_in_circulation INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Club memberships table
CREATE TABLE club_memberships (
    membership_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID REFERENCES clubs(club_id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    chip_balance INTEGER DEFAULT 0,
    matches_played INTEGER DEFAULT 0,
    matches_won INTEGER DEFAULT 0,
    joined_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(club_id, user_id)
);

-- Club chip transactions table
CREATE TABLE club_chip_transactions (
    transaction_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID REFERENCES clubs(club_id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    from_user_id UUID REFERENCES users(user_id),
    to_user_id UUID REFERENCES users(user_id),
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    reason TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Club tables table
CREATE TABLE club_tables (
    table_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID REFERENCES clubs(club_id) ON DELETE CASCADE,
    creator_user_id UUID REFERENCES users(user_id),
    stake_amount INTEGER NOT NULL,
    privacy VARCHAR(20) DEFAULT 'public' CHECK (privacy IN ('public', 'private')),
    status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'started', 'cancelled')),
    match_id UUID REFERENCES matches(match_id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Club join requests table
CREATE TABLE club_join_requests (
    request_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID REFERENCES clubs(club_id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(club_id, user_id)
);

-- Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_gold_transactions_user ON gold_transactions(user_id);
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_club_memberships_user ON club_memberships(user_id);
CREATE INDEX idx_club_memberships_club ON club_memberships(club_id);
