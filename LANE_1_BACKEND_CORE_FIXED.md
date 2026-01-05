# 🔵 LANE 1: BACKEND CORE (FIXED)
## Database + Authentication + Core API Infrastructure
## ✅ ALL SECURITY ISSUES PATCHED

---

## YOUR MISSION
Build the complete backend foundation:
- PostgreSQL database with full schema
- Node.js + Express + TypeScript server
- Authentication system (register, login, JWT)
- Core API infrastructure
- **WebSocket support built-in from start**

---

## PHASE 1: Project Initialization & Database Setup

### Step 1.1: Create Backend Project
```bash
cd /home/claude
mkdir -p backgammon-backend
cd backgammon-backend
npm init -y
```

### Step 1.2: Install ALL Dependencies (FIXED - includes all needed packages)
```bash
# Core packages
npm install express cors helmet morgan dotenv pg bcrypt jsonwebtoken zod uuid
npm install socket.io stripe express-rate-limit

# TypeScript and types
npm install -D typescript ts-node nodemon
npm install -D @types/node @types/express @types/bcrypt @types/jsonwebtoken @types/cors @types/pg @types/morgan @types/uuid
```

### Step 1.3: Create TypeScript Config
Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Step 1.4: Create Directory Structure (FIXED - includes validators)
```bash
mkdir -p src/{config,db,routes,controllers,services,repositories,middleware,utils,types,errors,validators,websocket}
```

### Step 1.5: Create Environment File (FIXED - secure secrets)
Create `.env`:
```bash
PORT=8000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/backgammon_club_dev

# Redis (optional for now)
REDIS_URL=redis://localhost:6379

# JWT Secrets - CHANGE THESE IN PRODUCTION!
# Generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_ACCESS_SECRET=dev_access_secret_change_this_in_production_must_be_at_least_32_characters_long
JWT_REFRESH_SECRET=dev_refresh_secret_change_this_in_production_must_be_at_least_32_characters_long

# CORS
CORS_ORIGIN=*

# Stripe (for Lane 5)
STRIPE_SECRET_KEY=sk_test_your_key_here
```

### Step 1.6: Create Database Schema
Create `database_schema.sql` in project root:
```sql
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
```

### Step 1.7: Setup Database
```bash
# Create database
createdb backgammon_club_dev

# Load schema
psql backgammon_club_dev < database_schema.sql
```

### Step 1.8: Create Database Connection
Create `src/db/connection.ts`:
```typescript
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export async function connectDatabase(): Promise<void> {
  try {
    const client = await pool.connect();
    console.log('✅ Database connected successfully');
    client.release();
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}

export default pool;
```

---

## PHASE 2: Core Infrastructure

### Step 2.1: Create Error Classes (FIXED - includes ForbiddenError)
Create `src/errors/AppError.ts`:
```typescript
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: any;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR', details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Access forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource already exists') {
    super(message, 409, 'CONFLICT');
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}
```

### Step 2.2: Create JWT Utilities
Create `src/utils/jwt.utils.ts`:
```typescript
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET!;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;

if (!ACCESS_SECRET || !REFRESH_SECRET) {
  throw new Error('JWT secrets must be defined in environment variables');
}

export interface JWTPayload {
  userId: string;
  email: string;
}

export function generateAccessToken(payload: JWTPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: '15m' });
}

export function generateRefreshToken(userId: string): string {
  return jwt.sign({ userId }, REFRESH_SECRET, { expiresIn: '7d' });
}

export function verifyAccessToken(token: string): JWTPayload {
  return jwt.verify(token, ACCESS_SECRET) as JWTPayload;
}

export function verifyRefreshToken(token: string): { userId: string } {
  return jwt.verify(token, REFRESH_SECRET) as { userId: string };
}
```

### Step 2.3: Create Password Utilities
Create `src/utils/password.utils.ts`:
```typescript
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12; // Increased from 10 for better security

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

### Step 2.4: Create Random Utilities (for game dice)
Create `src/utils/random.utils.ts`:
```typescript
import crypto from 'crypto';

export const randomUtils = {
  /**
   * Generate cryptographically secure random integer between min and max (inclusive)
   */
  randomInt(min: number, max: number): number {
    return crypto.randomInt(min, max + 1);
  },
  
  /**
   * Roll a single die (1-6)
   */
  rollDie(): number {
    return this.randomInt(1, 6);
  },
};
```

### Step 2.5: Create User Types (FIXED - includes last_daily_bonus_claim)
Create `src/types/user.types.ts`:
```typescript
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
```

### Step 2.6: Create Users Repository
Create `src/repositories/users.repository.ts`:
```typescript
import pool from '../db/connection';
import { User, CreateUserData } from '../types/user.types';

export class UsersRepository {
  async create(data: CreateUserData): Promise<User> {
    const query = `
      INSERT INTO users (email, username, password_hash, avatar_url, country)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const values = [
      data.email.toLowerCase().trim(),
      data.username.trim(),
      data.password_hash || null,
      data.avatar_url || null,
      data.country || null,
    ];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  async findByEmail(email: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE LOWER(email) = LOWER($1)';
    const result = await pool.query(query, [email.trim()]);
    return result.rows[0] || null;
  }

  async findByUsername(username: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE LOWER(username) = LOWER($1)';
    const result = await pool.query(query, [username.trim()]);
    return result.rows[0] || null;
  }

  async findById(userId: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE user_id = $1';
    const result = await pool.query(query, [userId]);
    return result.rows[0] || null;
  }

  async updateLastLogin(userId: string): Promise<void> {
    const query = 'UPDATE users SET last_login = NOW() WHERE user_id = $1';
    await pool.query(query, [userId]);
  }

  async updateGoldBalance(userId: string, newBalance: number): Promise<void> {
    const query = 'UPDATE users SET gold_balance = $1 WHERE user_id = $2';
    await pool.query(query, [newBalance, userId]);
  }

  async storeRefreshToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    const query = `
      INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
      VALUES ($1, $2, $3)
    `;
    await pool.query(query, [userId, tokenHash, expiresAt]);
  }

  async getRefreshTokens(userId: string): Promise<any[]> {
    const query = `
      SELECT * FROM refresh_tokens 
      WHERE user_id = $1 AND revoked = FALSE AND expires_at > NOW()
    `;
    const result = await pool.query(query, [userId]);
    return result.rows;
  }

  async revokeAllRefreshTokens(userId: string): Promise<void> {
    const query = 'UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1';
    await pool.query(query, [userId]);
  }
}

export const usersRepository = new UsersRepository();
```

### Step 2.7: Create Gold Repository (FIXED - expanded interface)
Create `src/repositories/gold.repository.ts`:
```typescript
import pool from '../db/connection';

export interface CreateGoldTransactionData {
  user_id: string;
  type: string;
  amount: number;
  balance_after: number;
  description?: string;
  payment_intent_id?: string;
  amount_usd?: number;
  related_match_id?: string;
  related_club_id?: string;
}

export class GoldRepository {
  async createTransaction(data: CreateGoldTransactionData): Promise<any> {
    const query = `
      INSERT INTO gold_transactions 
      (user_id, type, amount, balance_after, description, payment_intent_id, amount_usd, related_match_id, related_club_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    const values = [
      data.user_id,
      data.type,
      data.amount,
      data.balance_after,
      data.description || null,
      data.payment_intent_id || null,
      data.amount_usd || null,
      data.related_match_id || null,
      data.related_club_id || null,
    ];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  async getTransactionsByUser(userId: string, limit: number = 50, offset: number = 0): Promise<any[]> {
    const query = `
      SELECT * FROM gold_transactions 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(query, [userId, limit, offset]);
    return result.rows;
  }
}

export const goldRepository = new GoldRepository();
```

### Step 2.8: Create Auth Service
Create `src/services/auth.service.ts`:
```typescript
import pool from '../db/connection';
import { usersRepository } from '../repositories/users.repository';
import { goldRepository } from '../repositories/gold.repository';
import { hashPassword, verifyPassword } from '../utils/password.utils';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.utils';
import { User, LoginCredentials, RegisterData, SafeUser } from '../types/user.types';
import { ValidationError, AuthenticationError } from '../errors/AppError';

interface Tokens {
  access_token: string;
  refresh_token: string;
}

export class AuthService {
  async register(data: RegisterData): Promise<{ user: SafeUser; tokens: Tokens }> {
    // Validate age confirmation
    if (!data.age_confirmed) {
      throw new ValidationError('Age confirmation is required');
    }

    // Check email
    const existingEmail = await usersRepository.findByEmail(data.email);
    if (existingEmail) {
      throw new ValidationError('Email already registered');
    }

    // Check username
    const existingUsername = await usersRepository.findByUsername(data.username);
    if (existingUsername) {
      throw new ValidationError('Username already taken');
    }

    // Hash password
    const passwordHash = await hashPassword(data.password);

    // Create user
    const user = await usersRepository.create({
      email: data.email,
      username: data.username,
      password_hash: passwordHash,
      avatar_url: data.avatar_url,
      country: data.country,
    });

    // Create welcome bonus transaction
    await goldRepository.createTransaction({
      user_id: user.user_id,
      type: 'welcome_bonus',
      amount: 10000,
      balance_after: 10000,
      description: 'Welcome bonus for new account',
    });

    // Generate tokens
    const tokens = this.generateTokens(user);
    await this.storeRefreshToken(user.user_id, tokens.refresh_token);

    // Return user without password
    const { password_hash, ...safeUser } = user;
    return { user: safeUser as SafeUser, tokens };
  }

  async login(credentials: LoginCredentials): Promise<{ user: SafeUser; tokens: Tokens }> {
    const user = await usersRepository.findByEmail(credentials.email);
    
    if (!user || !user.password_hash) {
      throw new AuthenticationError('Invalid email or password');
    }

    const isPasswordValid = await verifyPassword(credentials.password, user.password_hash);
    if (!isPasswordValid) {
      throw new AuthenticationError('Invalid email or password');
    }

    if (!user.is_active) {
      throw new AuthenticationError('Account is deactivated');
    }

    if (user.is_banned) {
      throw new AuthenticationError('Account is banned');
    }

    await usersRepository.updateLastLogin(user.user_id);
    
    const tokens = this.generateTokens(user);
    await this.storeRefreshToken(user.user_id, tokens.refresh_token);

    const { password_hash, ...safeUser } = user;
    return { user: safeUser as SafeUser, tokens };
  }

  async refreshAccessToken(refreshToken: string): Promise<Tokens> {
    try {
      const decoded = verifyRefreshToken(refreshToken);
      const isValid = await this.verifyStoredRefreshToken(decoded.userId, refreshToken);
      
      if (!isValid) {
        throw new AuthenticationError('Invalid refresh token');
      }

      const user = await usersRepository.findById(decoded.userId);
      if (!user || !user.is_active) {
        throw new AuthenticationError('User not found or inactive');
      }

      const tokens = this.generateTokens(user);
      await this.storeRefreshToken(user.user_id, tokens.refresh_token);
      
      return tokens;
    } catch (error) {
      throw new AuthenticationError('Invalid or expired refresh token');
    }
  }

  async logout(userId: string): Promise<void> {
    await usersRepository.revokeAllRefreshTokens(userId);
  }

  async getProfile(userId: string): Promise<SafeUser> {
    const user = await usersRepository.findById(userId);
    if (!user) {
      throw new AuthenticationError('User not found');
    }
    const { password_hash, ...safeUser } = user;
    return safeUser as SafeUser;
  }

  private generateTokens(user: User): Tokens {
    return {
      access_token: generateAccessToken({ userId: user.user_id, email: user.email }),
      refresh_token: generateRefreshToken(user.user_id),
    };
  }

  private async storeRefreshToken(userId: string, token: string): Promise<void> {
    const tokenHash = await hashPassword(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await usersRepository.storeRefreshToken(userId, tokenHash, expiresAt);
  }

  private async verifyStoredRefreshToken(userId: string, token: string): Promise<boolean> {
    const storedTokens = await usersRepository.getRefreshTokens(userId);
    for (const storedToken of storedTokens) {
      const isMatch = await verifyPassword(token, storedToken.token_hash);
      if (isMatch) return true;
    }
    return false;
  }
}

export const authService = new AuthService();
```

### Step 2.9: Create Validation Schemas
Create `src/validators/auth.validator.ts`:
```typescript
import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email format').max(255),
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be at most 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password must be at most 100 characters'),
  avatar_url: z.string().url().optional().nullable(),
  country: z.string().length(3, 'Country code must be 3 characters'),
  age_confirmed: z.boolean().refine(val => val === true, 'Age confirmation is required'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export const refreshTokenSchema = z.object({
  refresh_token: z.string().min(1, 'Refresh token is required'),
});
```

### Step 2.10: Create Middlewares
Create `src/middleware/validation.middleware.ts`:
```typescript
import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { ValidationError } from '../errors/AppError';

export function validateRequest(schema: z.ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        next(new ValidationError('Validation failed', details));
      } else {
        next(error);
      }
    }
  };
}
```

Create `src/middleware/auth.middleware.ts`:
```typescript
import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.utils';
import { AuthenticationError } from '../errors/AppError';

declare global {
  namespace Express {
    interface Request {
      user?: { userId: string; email: string };
    }
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('No token provided');
    }

    const token = authHeader.substring(7);
    const decoded = verifyAccessToken(token);
    
    req.user = { userId: decoded.userId, email: decoded.email };
    next();
  } catch (error) {
    next(new AuthenticationError('Invalid or expired token'));
  }
}

export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = verifyAccessToken(token);
      req.user = { userId: decoded.userId, email: decoded.email };
    } catch {
      // Token invalid, but that's okay for optional auth
    }
  }
  
  next();
}
```

Create `src/middleware/error.middleware.ts`:
```typescript
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';

export function errorMiddleware(error: Error, req: Request, res: Response, next: NextFunction): void {
  // Log error for debugging (in production, use proper logger)
  console.error(`[ERROR] ${req.method} ${req.path}:`, error.message);

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      error: error.message,
      code: error.code,
      ...(error.details && process.env.NODE_ENV === 'development' && { details: error.details }),
    });
    return;
  }

  // Don't expose internal error details in production
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    code: 'INTERNAL_ERROR',
  });
}
```

Create `src/middleware/rateLimiter.middleware.ts`:
```typescript
import rateLimit from 'express-rate-limit';
import { RateLimitError } from '../errors/AppError';

// General API rate limiter
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: { success: false, error: 'Too many requests', code: 'RATE_LIMIT_EXCEEDED' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict limiter for auth endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  message: { success: false, error: 'Too many authentication attempts', code: 'RATE_LIMIT_EXCEEDED' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Very strict limiter for password reset, etc.
export const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 attempts per hour
  message: { success: false, error: 'Too many requests', code: 'RATE_LIMIT_EXCEEDED' },
  standardHeaders: true,
  legacyHeaders: false,
});
```

### Step 2.11: Create Auth Controller
Create `src/controllers/auth.controller.ts`:
```typescript
import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.register(req.body);
      res.status(201).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.login(req.body);
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refresh_token } = req.body;
      const tokens = await authService.refreshAccessToken(refresh_token);
      res.status(200).json({ success: true, ...tokens });
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user) {
        await authService.logout(req.user.userId);
      }
      res.status(200).json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
      next(error);
    }
  }

  async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await authService.getProfile(req.user!.userId);
      res.status(200).json({ success: true, user });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
```

### Step 2.12: Create Auth Routes
Create `src/routes/auth.routes.ts`:
```typescript
import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { validateRequest } from '../middleware/validation.middleware';
import { authMiddleware } from '../middleware/auth.middleware';
import { authLimiter } from '../middleware/rateLimiter.middleware';
import { registerSchema, loginSchema, refreshTokenSchema } from '../validators/auth.validator';

const router = Router();

// Apply rate limiting to auth routes
router.use(authLimiter);

router.post('/register', validateRequest(registerSchema), authController.register.bind(authController));
router.post('/login', validateRequest(loginSchema), authController.login.bind(authController));
router.post('/refresh', validateRequest(refreshTokenSchema), authController.refreshToken.bind(authController));
router.post('/logout', authMiddleware, authController.logout.bind(authController));
router.get('/profile', authMiddleware, authController.getProfile.bind(authController));

export default router;
```

---

## PHASE 3: Express App & Server

### Step 3.1: Create Routes Index
Create `src/routes/index.ts`:
```typescript
import { Router } from 'express';
import authRoutes from './auth.routes';
// These will be added by other lanes:
// import goldRoutes from './gold.routes';
// import matchesRoutes from './matches.routes';
// import clubsRoutes from './clubs.routes';

const router = Router();

// Health check
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Route modules
router.use('/auth', authRoutes);
// router.use('/gold', goldRoutes);     // Added by Lane 5
// router.use('/matches', matchesRoutes); // Added by Lane 3
// router.use('/clubs', clubsRoutes);   // Added by Lane 6

export default router;
```

### Step 3.2: Create Express App
Create `src/app.ts`:
```typescript
import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import routes from './routes';
import { errorMiddleware } from './middleware/error.middleware';
import { apiLimiter } from './middleware/rateLimiter.middleware';

const app: Application = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN === '*' ? '*' : process.env.CORS_ORIGIN?.split(','),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// Rate limiting
app.use(apiLimiter);

// Routes
app.use('/v1', routes);

// Error handling (must be last)
app.use(errorMiddleware);

export default app;
```

### Step 3.3: Create Server with WebSocket Support (UNIFIED)
Create `src/server.ts`:
```typescript
import dotenv from 'dotenv';
dotenv.config();

import { createServer } from 'http';
import app from './app';
import { connectDatabase } from './db/connection';
// WebSocket will be imported when Lane 4 is implemented:
// import { initializeWebSocket } from './websocket';

const PORT = process.env.PORT || 8000;

async function startServer() {
  try {
    // Connect to database
    await connectDatabase();
    console.log('✅ Database connected');

    // Create HTTP server (needed for WebSocket)
    const server = createServer(app);

    // Initialize WebSocket (uncomment when Lane 4 is complete)
    // initializeWebSocket(server);
    // console.log('✅ WebSocket initialized');

    // Start listening
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📍 Health: http://localhost:${PORT}/v1/health`);
      console.log(`📍 API: http://localhost:${PORT}/v1`);
      // console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
```

### Step 3.4: Update package.json
Add to `package.json`:
```json
{
  "scripts": {
    "dev": "nodemon --exec ts-node src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "db:setup": "psql -d backgammon_club_dev -f database_schema.sql"
  }
}
```

---

## PHASE 4: Testing

### Step 4.1: Start Server
```bash
cd /home/claude/backgammon-backend
npm run dev
```

### Step 4.2: Test Health Check
```bash
curl http://localhost:8000/v1/health
```
Expected:
```json
{"success":true,"status":"OK","timestamp":"...","uptime":...}
```

### Step 4.3: Test Registration
```bash
curl -X POST http://localhost:8000/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "test@example.com",
    "username": "testuser",
    "password": "password123",
    "country": "USA",
    "age_confirmed": true
  }'
```

### Step 4.4: Test Login
```bash
curl -X POST http://localhost:8000/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

### Step 4.5: Test Profile (with token from login)
```bash
curl http://localhost:8000/v1/auth/profile \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN_HERE'
```

---

## ✅ LANE 1 COMPLETION CHECKLIST

- [ ] All npm packages installed (including types)
- [ ] TypeScript configured
- [ ] All directories created
- [ ] .env file created with secure defaults
- [ ] Database schema created and loaded
- [ ] Database connection works
- [ ] All error classes defined (including ForbiddenError)
- [ ] JWT utilities working
- [ ] Password utilities working
- [ ] Users repository complete
- [ ] Gold repository complete (expanded interface)
- [ ] Auth service complete
- [ ] Rate limiting configured
- [ ] Validation middleware working
- [ ] Auth middleware working
- [ ] Auth controller complete
- [ ] Auth routes configured
- [ ] Express app configured
- [ ] Server starts successfully
- [ ] Health check returns OK
- [ ] User registration works
- [ ] User login works
- [ ] Profile endpoint works

**When all items are checked, LANE 1 IS COMPLETE!**

---

## 📁 FILES CREATED IN LANE 1

```
backgammon-backend/
├── .env
├── database_schema.sql
├── tsconfig.json
├── package.json
└── src/
    ├── server.ts
    ├── app.ts
    ├── db/
    │   └── connection.ts
    ├── errors/
    │   └── AppError.ts
    ├── utils/
    │   ├── jwt.utils.ts
    │   ├── password.utils.ts
    │   └── random.utils.ts
    ├── types/
    │   └── user.types.ts
    ├── repositories/
    │   ├── users.repository.ts
    │   └── gold.repository.ts
    ├── services/
    │   └── auth.service.ts
    ├── validators/
    │   └── auth.validator.ts
    ├── middleware/
    │   ├── auth.middleware.ts
    │   ├── validation.middleware.ts
    │   ├── error.middleware.ts
    │   └── rateLimiter.middleware.ts
    ├── controllers/
    │   └── auth.controller.ts
    ├── routes/
    │   ├── index.ts
    │   └── auth.routes.ts
    ├── config/
    │   └── (empty - for Lane 5)
    └── websocket/
        └── (empty - for Lane 4)
```
