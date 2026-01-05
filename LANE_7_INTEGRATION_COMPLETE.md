# 🚀 LANE 7: INTEGRATION & COMPLETION
## All Missing Pieces for 100% MVP
## The Final Lane - Makes Everything Work Together

---

## YOUR MISSION
Complete the MVP by adding:
- Matchmaking system (find opponents)
- Match screen (actual gameplay)
- Create club screen
- Leaderboard system
- Chat persistence
- Error handling
- End-to-end game flow

---

## PREREQUISITES
- **Lanes 1-6 must be complete** (all features built)
- Backend running on port 8000
- Frontend running in Expo Go

---

## PHASE 1: Database Schema Updates

### Step 1.1: Add Missing Tables
Run this SQL on your database:
```sql
-- Matchmaking queue table
CREATE TABLE matchmaking_queue (
    queue_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    stake_amount INTEGER NOT NULL,
    match_type VARCHAR(20) DEFAULT 'gold' CHECK (match_type IN ('gold', 'club')),
    club_id UUID REFERENCES clubs(club_id),
    status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'matched', 'cancelled', 'expired')),
    matched_with_user_id UUID REFERENCES users(user_id),
    match_id UUID REFERENCES matches(match_id),
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '5 minutes',
    UNIQUE(user_id, status) -- One active queue entry per user
);

-- Chat messages table (for persistence)
CREATE TABLE chat_messages (
    message_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID REFERENCES clubs(club_id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    username VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'system', 'emote')),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Notifications table
CREATE TABLE notifications (
    notification_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    body TEXT,
    data JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Match moves history (for replay/verification)
CREATE TABLE match_moves (
    move_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID REFERENCES matches(match_id) ON DELETE CASCADE,
    player_id UUID REFERENCES users(user_id),
    move_number INTEGER NOT NULL,
    dice_values INTEGER[] NOT NULL,
    moves JSONB NOT NULL,
    game_state_after JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_matchmaking_queue_status ON matchmaking_queue(status, stake_amount);
CREATE INDEX idx_matchmaking_queue_user ON matchmaking_queue(user_id);
CREATE INDEX idx_chat_messages_club ON chat_messages(club_id, created_at DESC);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX idx_match_moves_match ON match_moves(match_id, move_number);
```

---

## PHASE 2: Backend Matchmaking System

### Step 2.1: Create Matchmaking Types
Create `src/types/matchmaking.types.ts`:
```typescript
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
```

### Step 2.2: Create Matchmaking Repository
Create `src/repositories/matchmaking.repository.ts`:
```typescript
import pool from '../db/connection';
import { QueueEntry } from '../types/matchmaking.types';

export class MatchmakingRepository {
  async addToQueue(data: {
    user_id: string;
    stake_amount: number;
    match_type?: 'gold' | 'club';
    club_id?: string;
  }): Promise<QueueEntry> {
    // First, cancel any existing queue entries for this user
    await pool.query(
      "UPDATE matchmaking_queue SET status = 'cancelled' WHERE user_id = $1 AND status = 'waiting'",
      [data.user_id]
    );

    const query = `
      INSERT INTO matchmaking_queue (user_id, stake_amount, match_type, club_id)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const result = await pool.query(query, [
      data.user_id,
      data.stake_amount,
      data.match_type || 'gold',
      data.club_id || null,
    ]);
    return result.rows[0];
  }

  async findMatch(queueEntry: QueueEntry): Promise<QueueEntry | null> {
    // Find another player with same stake amount, different user
    const query = `
      SELECT mq.*, u.username, u.level, u.wins
      FROM matchmaking_queue mq
      JOIN users u ON mq.user_id = u.user_id
      WHERE mq.status = 'waiting'
        AND mq.stake_amount = $1
        AND mq.match_type = $2
        AND mq.user_id != $3
        AND mq.expires_at > NOW()
        ${queueEntry.club_id ? 'AND mq.club_id = $4' : 'AND mq.club_id IS NULL'}
      ORDER BY mq.created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `;
    
    const values = queueEntry.club_id 
      ? [queueEntry.stake_amount, queueEntry.match_type, queueEntry.user_id, queueEntry.club_id]
      : [queueEntry.stake_amount, queueEntry.match_type, queueEntry.user_id];
    
    const result = await pool.query(query, values);
    return result.rows[0] || null;
  }

  async getQueueEntry(userId: string): Promise<QueueEntry | null> {
    const query = `
      SELECT * FROM matchmaking_queue 
      WHERE user_id = $1 AND status = 'waiting'
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const result = await pool.query(query, [userId]);
    return result.rows[0] || null;
  }

  async updateQueueStatus(
    queueId: string, 
    status: string, 
    matchedWith?: string, 
    matchId?: string
  ): Promise<void> {
    await pool.query(
      `UPDATE matchmaking_queue 
       SET status = $1, matched_with_user_id = $2, match_id = $3 
       WHERE queue_id = $4`,
      [status, matchedWith || null, matchId || null, queueId]
    );
  }

  async cancelQueue(userId: string): Promise<boolean> {
    const result = await pool.query(
      "UPDATE matchmaking_queue SET status = 'cancelled' WHERE user_id = $1 AND status = 'waiting' RETURNING *",
      [userId]
    );
    return result.rowCount > 0;
  }

  async getQueuePosition(queueEntry: QueueEntry): Promise<number> {
    const query = `
      SELECT COUNT(*) as position
      FROM matchmaking_queue
      WHERE status = 'waiting'
        AND stake_amount = $1
        AND match_type = $2
        AND created_at < $3
    `;
    const result = await pool.query(query, [
      queueEntry.stake_amount,
      queueEntry.match_type,
      queueEntry.created_at,
    ]);
    return parseInt(result.rows[0].position) + 1;
  }

  async cleanExpiredEntries(): Promise<number> {
    const result = await pool.query(
      "UPDATE matchmaking_queue SET status = 'expired' WHERE status = 'waiting' AND expires_at < NOW() RETURNING *"
    );
    return result.rowCount;
  }
}

export const matchmakingRepository = new MatchmakingRepository();
```

### Step 2.3: Create Matchmaking Service
Create `src/services/matchmaking.service.ts`:
```typescript
import pool from '../db/connection';
import { matchmakingRepository } from '../repositories/matchmaking.repository';
import { matchesRepository } from '../repositories/matches.repository';
import { usersRepository } from '../repositories/users.repository';
import { gameEngineService } from './game-engine.service';
import { wsUtils } from '../websocket';
import { MatchmakingResult, QueueEntry } from '../types/matchmaking.types';
import { ValidationError, NotFoundError } from '../errors/AppError';

export class MatchmakingService {
  /**
   * Join matchmaking queue
   */
  async joinQueue(
    userId: string, 
    stakeAmount: number,
    matchType: 'gold' | 'club' = 'gold',
    clubId?: string
  ): Promise<MatchmakingResult> {
    // Validate user has enough gold/chips
    const user = await usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User');
    }

    if (matchType === 'gold' && user.gold_balance < stakeAmount) {
      throw new ValidationError(`Insufficient gold. You have ${user.gold_balance}, need ${stakeAmount}`);
    }

    // For club matches, validate chip balance
    if (matchType === 'club' && clubId) {
      const membership = await pool.query(
        'SELECT chip_balance FROM club_memberships WHERE club_id = $1 AND user_id = $2',
        [clubId, userId]
      );
      if (!membership.rows[0] || membership.rows[0].chip_balance < stakeAmount) {
        throw new ValidationError('Insufficient chips for this stake');
      }
    }

    // Add to queue
    const queueEntry = await matchmakingRepository.addToQueue({
      user_id: userId,
      stake_amount: stakeAmount,
      match_type: matchType,
      club_id: clubId,
    });

    // Try to find immediate match
    const opponent = await matchmakingRepository.findMatch(queueEntry);

    if (opponent) {
      // Match found! Create the match
      const match = await this.createMatchFromQueue(queueEntry, opponent);
      
      return {
        matched: true,
        match_id: match.match_id,
        opponent: {
          user_id: opponent.user_id,
          username: opponent.username!,
          level: opponent.level!,
          wins: opponent.wins!,
        },
      };
    }

    // No immediate match, return queue position
    const position = await matchmakingRepository.getQueuePosition(queueEntry);
    
    return {
      matched: false,
      queue_position: position,
      estimated_wait: position * 15, // Rough estimate: 15 seconds per position
    };
  }

  /**
   * Create match from two queue entries
   */
  private async createMatchFromQueue(entry1: QueueEntry, entry2: QueueEntry): Promise<any> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Randomly assign colors
      const whitePlayer = Math.random() < 0.5 ? entry1.user_id : entry2.user_id;
      const blackPlayer = whitePlayer === entry1.user_id ? entry2.user_id : entry1.user_id;

      // Initialize game state
      const initialState = gameEngineService.initializeGame();

      // Create match
      const matchResult = await client.query(
        `INSERT INTO matches 
         (match_type, status, player_white_id, player_black_id, stake_amount, club_id, game_state)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          entry1.match_type,
          'ready',
          whitePlayer,
          blackPlayer,
          entry1.stake_amount,
          entry1.club_id,
          JSON.stringify(initialState),
        ]
      );
      const match = matchResult.rows[0];

      // Update both queue entries
      await client.query(
        "UPDATE matchmaking_queue SET status = 'matched', matched_with_user_id = $1, match_id = $2 WHERE queue_id = $3",
        [entry2.user_id, match.match_id, entry1.queue_id]
      );
      await client.query(
        "UPDATE matchmaking_queue SET status = 'matched', matched_with_user_id = $1, match_id = $2 WHERE queue_id = $3",
        [entry1.user_id, match.match_id, entry2.queue_id]
      );

      await client.query('COMMIT');

      // Notify both players via WebSocket
      const whiteUser = await usersRepository.findById(whitePlayer);
      const blackUser = await usersRepository.findById(blackPlayer);

      wsUtils.emitToUser(whitePlayer, 'match_found', {
        match_id: match.match_id,
        opponent: { user_id: blackPlayer, username: blackUser?.username },
        your_color: 'white',
        stake_amount: entry1.stake_amount,
      });

      wsUtils.emitToUser(blackPlayer, 'match_found', {
        match_id: match.match_id,
        opponent: { user_id: whitePlayer, username: whiteUser?.username },
        your_color: 'black',
        stake_amount: entry1.stake_amount,
      });

      return match;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Leave matchmaking queue
   */
  async leaveQueue(userId: string): Promise<boolean> {
    const cancelled = await matchmakingRepository.cancelQueue(userId);
    return cancelled;
  }

  /**
   * Get current queue status
   */
  async getQueueStatus(userId: string): Promise<{ in_queue: boolean; position?: number; stake_amount?: number }> {
    const entry = await matchmakingRepository.getQueueEntry(userId);
    
    if (!entry) {
      return { in_queue: false };
    }

    const position = await matchmakingRepository.getQueuePosition(entry);
    
    return {
      in_queue: true,
      position,
      stake_amount: entry.stake_amount,
    };
  }

  /**
   * Background job: Try to match queued players
   */
  async processQueue(): Promise<number> {
    // Clean expired entries first
    await matchmakingRepository.cleanExpiredEntries();

    // Get all waiting entries
    const result = await pool.query(
      "SELECT * FROM matchmaking_queue WHERE status = 'waiting' AND expires_at > NOW() ORDER BY created_at ASC"
    );
    
    let matchesCreated = 0;
    const processedIds = new Set<string>();

    for (const entry of result.rows) {
      if (processedIds.has(entry.queue_id)) continue;

      const opponent = await matchmakingRepository.findMatch(entry);
      
      if (opponent && !processedIds.has(opponent.queue_id)) {
        await this.createMatchFromQueue(entry, opponent);
        processedIds.add(entry.queue_id);
        processedIds.add(opponent.queue_id);
        matchesCreated++;
      }
    }

    return matchesCreated;
  }
}

export const matchmakingService = new MatchmakingService();

// Start background queue processor (runs every 5 seconds)
setInterval(async () => {
  try {
    await matchmakingService.processQueue();
  } catch (error) {
    console.error('Queue processor error:', error);
  }
}, 5000);
```

### Step 2.4: Create Matchmaking Controller
Create `src/controllers/matchmaking.controller.ts`:
```typescript
import { Request, Response, NextFunction } from 'express';
import { matchmakingService } from '../services/matchmaking.service';

export class MatchmakingController {
  async joinQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { stake_amount, match_type, club_id } = req.body;
      const result = await matchmakingService.joinQueue(
        req.user!.userId,
        stake_amount,
        match_type,
        club_id
      );
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async leaveQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cancelled = await matchmakingService.leaveQueue(req.user!.userId);
      res.status(200).json({ success: true, cancelled });
    } catch (error) {
      next(error);
    }
  }

  async getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = await matchmakingService.getQueueStatus(req.user!.userId);
      res.status(200).json({ success: true, ...status });
    } catch (error) {
      next(error);
    }
  }
}

export const matchmakingController = new MatchmakingController();
```

### Step 2.5: Create Matchmaking Routes
Create `src/routes/matchmaking.routes.ts`:
```typescript
import { Router } from 'express';
import { matchmakingController } from '../controllers/matchmaking.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { z } from 'zod';

const router = Router();

const joinQueueSchema = z.object({
  stake_amount: z.number().positive().max(1000000),
  match_type: z.enum(['gold', 'club']).optional(),
  club_id: z.string().uuid().optional(),
});

router.use(authMiddleware);

router.post('/join', validateRequest(joinQueueSchema), matchmakingController.joinQueue.bind(matchmakingController));
router.post('/leave', matchmakingController.leaveQueue.bind(matchmakingController));
router.get('/status', matchmakingController.getStatus.bind(matchmakingController));

export default router;
```

### Step 2.6: Add to Routes Index
Update `src/routes/index.ts`:
```typescript
import { Router } from 'express';
import authRoutes from './auth.routes';
import goldRoutes from './gold.routes';
import clubsRoutes from './clubs.routes';
import matchesRoutes from './matches.routes';
import matchmakingRoutes from './matchmaking.routes'; // NEW

const router = Router();

router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

router.use('/auth', authRoutes);
router.use('/gold', goldRoutes);
router.use('/clubs', clubsRoutes);
router.use('/matches', matchesRoutes);
router.use('/matchmaking', matchmakingRoutes); // NEW

export default router;
```

---

## PHASE 3: Backend Match Flow Completion

### Step 3.1: Complete Matches Repository
Create/Update `src/repositories/matches.repository.ts`:
```typescript
import pool from '../db/connection';
import { Match, GameState } from '../types/game.types';

export class MatchesRepository {
  async create(data: {
    match_type: 'gold' | 'club';
    player_white_id: string;
    player_black_id?: string;
    stake_amount: number;
    club_id?: string;
    game_state?: GameState;
  }): Promise<Match> {
    const query = `
      INSERT INTO matches (match_type, player_white_id, player_black_id, stake_amount, club_id, game_state)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const result = await pool.query(query, [
      data.match_type,
      data.player_white_id,
      data.player_black_id || null,
      data.stake_amount,
      data.club_id || null,
      data.game_state ? JSON.stringify(data.game_state) : null,
    ]);
    return this.parseMatch(result.rows[0]);
  }

  async findById(matchId: string): Promise<Match | null> {
    const query = `
      SELECT m.*, 
             pw.username as player_white_username,
             pb.username as player_black_username
      FROM matches m
      LEFT JOIN users pw ON m.player_white_id = pw.user_id
      LEFT JOIN users pb ON m.player_black_id = pb.user_id
      WHERE m.match_id = $1
    `;
    const result = await pool.query(query, [matchId]);
    return result.rows[0] ? this.parseMatch(result.rows[0]) : null;
  }

  async updateGameState(matchId: string, gameState: GameState): Promise<void> {
    await pool.query(
      'UPDATE matches SET game_state = $1, last_move_at = NOW() WHERE match_id = $2',
      [JSON.stringify(gameState), matchId]
    );
  }

  async updateStatus(matchId: string, status: string): Promise<void> {
    const updates: Record<string, any> = { status };
    
    if (status === 'in_progress') {
      updates.started_at = 'NOW()';
    } else if (status === 'completed' || status === 'abandoned') {
      updates.completed_at = 'NOW()';
    }

    const setClause = Object.keys(updates)
      .map((key, i) => `${key} = ${updates[key] === 'NOW()' ? 'NOW()' : `$${i + 2}`}`)
      .join(', ');
    
    const values = Object.values(updates).filter(v => v !== 'NOW()');
    
    await pool.query(
      `UPDATE matches SET ${setClause} WHERE match_id = $1`,
      [matchId, ...values]
    );
  }

  async setWinner(matchId: string, winnerId: string, finalCubeValue: number = 1): Promise<void> {
    await pool.query(
      `UPDATE matches 
       SET winner_id = $1, final_cube_value = $2, status = 'completed', completed_at = NOW()
       WHERE match_id = $3`,
      [winnerId, finalCubeValue, matchId]
    );
  }

  async setPlayerReady(matchId: string, playerId: string, isWhite: boolean): Promise<void> {
    const column = isWhite ? 'player_white_ready' : 'player_black_ready';
    await pool.query(
      `UPDATE matches SET ${column} = TRUE WHERE match_id = $1`,
      [matchId]
    );
  }

  async getUserMatches(userId: string, status?: string, limit: number = 20): Promise<Match[]> {
    let query = `
      SELECT m.*, 
             pw.username as player_white_username,
             pb.username as player_black_username
      FROM matches m
      LEFT JOIN users pw ON m.player_white_id = pw.user_id
      LEFT JOIN users pb ON m.player_black_id = pb.user_id
      WHERE (m.player_white_id = $1 OR m.player_black_id = $1)
    `;
    const values: any[] = [userId];

    if (status) {
      query += ` AND m.status = $2`;
      values.push(status);
    }

    query += ` ORDER BY m.created_at DESC LIMIT $${values.length + 1}`;
    values.push(limit);

    const result = await pool.query(query, values);
    return result.rows.map(row => this.parseMatch(row));
  }

  async recordMove(matchId: string, playerId: string, moveNumber: number, diceValues: number[], moves: any[], gameStateAfter: GameState): Promise<void> {
    await pool.query(
      `INSERT INTO match_moves (match_id, player_id, move_number, dice_values, moves, game_state_after)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [matchId, playerId, moveNumber, diceValues, JSON.stringify(moves), JSON.stringify(gameStateAfter)]
    );
  }

  private parseMatch(row: any): Match {
    return {
      ...row,
      game_state: row.game_state ? (typeof row.game_state === 'string' ? JSON.parse(row.game_state) : row.game_state) : null,
    };
  }
}

export const matchesRepository = new MatchesRepository();
```

### Step 3.2: Complete Matches Service
Create/Update `src/services/matches.service.ts`:
```typescript
import pool from '../db/connection';
import { matchesRepository } from '../repositories/matches.repository';
import { usersRepository } from '../repositories/users.repository';
import { goldRepository } from '../repositories/gold.repository';
import { gameEngineService } from './game-engine.service';
import { wsUtils } from '../websocket';
import { Match, GameState, Move, Color } from '../types/game.types';
import { ValidationError, NotFoundError, ForbiddenError } from '../errors/AppError';

export class MatchesService {
  /**
   * Get match details
   */
  async getMatch(matchId: string, userId?: string): Promise<Match & { your_color?: Color }> {
    const match = await matchesRepository.findById(matchId);
    if (!match) {
      throw new NotFoundError('Match');
    }

    let result: any = { ...match };
    
    if (userId) {
      if (match.player_white_id === userId) {
        result.your_color = 'white';
      } else if (match.player_black_id === userId) {
        result.your_color = 'black';
      }
    }

    return result;
  }

  /**
   * Set player ready
   */
  async setReady(matchId: string, userId: string): Promise<{ both_ready: boolean; game_state?: GameState }> {
    const match = await matchesRepository.findById(matchId);
    if (!match) {
      throw new NotFoundError('Match');
    }

    if (match.status !== 'ready' && match.status !== 'waiting') {
      throw new ValidationError('Match already started or completed');
    }

    const isWhite = match.player_white_id === userId;
    const isBlack = match.player_black_id === userId;

    if (!isWhite && !isBlack) {
      throw new ForbiddenError('Not a player in this match');
    }

    await matchesRepository.setPlayerReady(matchId, userId, isWhite);

    // Notify opponent
    wsUtils.emitToMatch(matchId, 'player_ready_status', {
      match_id: matchId,
      user_id: userId,
      ready: true,
    });

    // Check if both ready
    const updatedMatch = await matchesRepository.findById(matchId);
    const bothReady = updatedMatch!.player_white_ready && updatedMatch!.player_black_ready;

    if (bothReady) {
      // Initialize game and start
      const gameState = gameEngineService.initializeGame();
      const dice = gameEngineService.rollDice();
      gameState.dice = dice;

      await matchesRepository.updateGameState(matchId, gameState);
      await matchesRepository.updateStatus(matchId, 'in_progress');

      // Notify both players
      wsUtils.emitToMatch(matchId, 'match_started', {
        match_id: matchId,
        game_state: gameState,
        current_turn: gameState.current_turn,
      });

      return { both_ready: true, game_state: gameState };
    }

    return { both_ready: false };
  }

  /**
   * Roll dice
   */
  async rollDice(matchId: string, userId: string): Promise<{ dice: any[]; legal_moves: Move[] }> {
    const match = await matchesRepository.findById(matchId);
    if (!match) {
      throw new NotFoundError('Match');
    }

    if (match.status !== 'in_progress') {
      throw new ValidationError('Match not in progress');
    }

    const isWhite = match.player_white_id === userId;
    const isBlack = match.player_black_id === userId;
    
    if (!isWhite && !isBlack) {
      throw new ForbiddenError('Not a player in this match');
    }

    const playerColor: Color = isWhite ? 'white' : 'black';
    const gameState = match.game_state!;

    if (gameState.current_turn !== playerColor) {
      throw new ValidationError('Not your turn');
    }

    if (gameState.dice.length > 0 && gameState.dice.some(d => !d.used)) {
      throw new ValidationError('Dice already rolled, make your moves');
    }

    // Roll dice
    const dice = gameEngineService.rollDice();
    gameState.dice = dice;

    await matchesRepository.updateGameState(matchId, gameState);

    // Get legal moves
    const legalMoves = gameEngineService.getLegalMoves(gameState);

    // Notify opponent
    wsUtils.emitToMatch(matchId, 'turn_changed', {
      match_id: matchId,
      current_turn: playerColor,
      dice: dice,
      deadline: new Date(Date.now() + 60000).toISOString(), // 60 second turn
    });

    return { dice, legal_moves: legalMoves };
  }

  /**
   * Make a move
   */
  async makeMove(matchId: string, userId: string, moves: Move[]): Promise<{
    game_state: GameState;
    legal_moves: Move[];
    turn_complete: boolean;
    game_over: boolean;
    winner?: string;
  }> {
    const match = await matchesRepository.findById(matchId);
    if (!match) {
      throw new NotFoundError('Match');
    }

    if (match.status !== 'in_progress') {
      throw new ValidationError('Match not in progress');
    }

    const isWhite = match.player_white_id === userId;
    const playerColor: Color = isWhite ? 'white' : 'black';
    let gameState = match.game_state!;

    if (gameState.current_turn !== playerColor) {
      throw new ValidationError('Not your turn');
    }

    // Apply each move
    for (const move of moves) {
      const legalMoves = gameEngineService.getLegalMoves(gameState);
      const isLegal = legalMoves.some(
        m => m.from === move.from && m.to === move.to && m.die_value === move.die_value
      );

      if (!isLegal) {
        throw new ValidationError('Illegal move');
      }

      gameState = gameEngineService.applyMove(gameState, move, playerColor);
    }

    // Check if turn is complete (all dice used or no legal moves)
    const remainingMoves = gameEngineService.getLegalMoves(gameState);
    const turnComplete = remainingMoves.length === 0;

    // Check for game over
    const gameOver = gameEngineService.isGameOver(gameState);
    let winner: string | undefined;

    if (gameOver) {
      winner = gameState.off[playerColor] === 15 ? userId : 
               (isWhite ? match.player_black_id : match.player_white_id);
      
      await this.completeMatch(matchId, winner, match);
    } else if (turnComplete) {
      // Switch turns
      gameState.current_turn = playerColor === 'white' ? 'black' : 'white';
      gameState.dice = [];
    }

    await matchesRepository.updateGameState(matchId, gameState);

    // Record move
    const moveNumber = await this.getMoveNumber(matchId);
    await matchesRepository.recordMove(
      matchId, 
      userId, 
      moveNumber, 
      moves.map(m => m.die_value),
      moves,
      gameState
    );

    // Notify opponent
    wsUtils.emitToMatch(matchId, 'move_made', {
      match_id: matchId,
      moves: moves,
      game_state: gameState,
      turn_complete: turnComplete,
    });

    if (gameOver) {
      wsUtils.emitToMatch(matchId, 'match_completed', {
        match_id: matchId,
        winner: winner,
        game_state: gameState,
      });
    }

    return {
      game_state: gameState,
      legal_moves: remainingMoves,
      turn_complete: turnComplete,
      game_over: gameOver,
      winner,
    };
  }

  /**
   * Complete match and transfer gold/chips
   */
  private async completeMatch(matchId: string, winnerId: string, match: Match): Promise<void> {
    const loserId = winnerId === match.player_white_id 
      ? match.player_black_id 
      : match.player_white_id;

    const stakeAmount = match.stake_amount * (match.final_cube_value || 1);

    await matchesRepository.setWinner(matchId, winnerId, match.final_cube_value || 1);

    if (match.match_type === 'gold') {
      // Transfer gold
      await this.transferGold(winnerId, loserId, stakeAmount, matchId);
    } else if (match.match_type === 'club' && match.club_id) {
      // Transfer chips
      await this.transferChips(match.club_id, winnerId, loserId, stakeAmount);
    }

    // Update user stats
    await pool.query(
      'UPDATE users SET wins = wins + 1, total_matches = total_matches + 1 WHERE user_id = $1',
      [winnerId]
    );
    await pool.query(
      'UPDATE users SET losses = losses + 1, total_matches = total_matches + 1 WHERE user_id = $1',
      [loserId]
    );
  }

  private async transferGold(winnerId: string, loserId: string, amount: number, matchId: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get current balances
      const winner = await usersRepository.findById(winnerId);
      const loser = await usersRepository.findById(loserId);

      if (!winner || !loser) {
        throw new Error('Player not found');
      }

      const actualAmount = Math.min(amount, loser.gold_balance);
      
      // Deduct from loser
      const newLoserBalance = loser.gold_balance - actualAmount;
      await client.query(
        'UPDATE users SET gold_balance = $1, total_gold_spent = total_gold_spent + $2 WHERE user_id = $3',
        [newLoserBalance, actualAmount, loserId]
      );

      // Add to winner
      const newWinnerBalance = winner.gold_balance + actualAmount;
      await client.query(
        'UPDATE users SET gold_balance = $1, total_gold_earned = total_gold_earned + $2 WHERE user_id = $3',
        [newWinnerBalance, actualAmount, winnerId]
      );

      // Record transactions
      await goldRepository.createTransaction({
        user_id: loserId,
        type: 'match_loss',
        amount: -actualAmount,
        balance_after: newLoserBalance,
        description: 'Match loss',
        related_match_id: matchId,
      });

      await goldRepository.createTransaction({
        user_id: winnerId,
        type: 'match_win',
        amount: actualAmount,
        balance_after: newWinnerBalance,
        description: 'Match win',
        related_match_id: matchId,
      });

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async transferChips(clubId: string, winnerId: string, loserId: string, amount: number): Promise<void> {
    // Get loser's chip balance
    const loserMembership = await pool.query(
      'SELECT chip_balance FROM club_memberships WHERE club_id = $1 AND user_id = $2',
      [clubId, loserId]
    );
    
    const actualAmount = Math.min(amount, loserMembership.rows[0]?.chip_balance || 0);

    // Transfer chips
    await pool.query(
      'UPDATE club_memberships SET chip_balance = chip_balance - $1 WHERE club_id = $2 AND user_id = $3',
      [actualAmount, clubId, loserId]
    );
    await pool.query(
      'UPDATE club_memberships SET chip_balance = chip_balance + $1 WHERE club_id = $2 AND user_id = $3',
      [actualAmount, clubId, winnerId]
    );
  }

  private async getMoveNumber(matchId: string): Promise<number> {
    const result = await pool.query(
      'SELECT COALESCE(MAX(move_number), 0) + 1 as next FROM match_moves WHERE match_id = $1',
      [matchId]
    );
    return result.rows[0].next;
  }

  /**
   * Get user's match history
   */
  async getMatchHistory(userId: string, limit: number = 20): Promise<Match[]> {
    return matchesRepository.getUserMatches(userId, undefined, limit);
  }

  /**
   * Forfeit match
   */
  async forfeit(matchId: string, userId: string): Promise<void> {
    const match = await matchesRepository.findById(matchId);
    if (!match) {
      throw new NotFoundError('Match');
    }

    if (match.status !== 'in_progress') {
      throw new ValidationError('Match not in progress');
    }

    const isWhite = match.player_white_id === userId;
    const isBlack = match.player_black_id === userId;

    if (!isWhite && !isBlack) {
      throw new ForbiddenError('Not a player in this match');
    }

    const winnerId = isWhite ? match.player_black_id : match.player_white_id;
    await this.completeMatch(matchId, winnerId, match);

    wsUtils.emitToMatch(matchId, 'match_completed', {
      match_id: matchId,
      winner: winnerId,
      reason: 'forfeit',
    });
  }
}

export const matchesService = new MatchesService();
```

### Step 3.3: Complete Matches Controller
Create `src/controllers/matches.controller.ts`:
```typescript
import { Request, Response, NextFunction } from 'express';
import { matchesService } from '../services/matches.service';

export class MatchesController {
  async getMatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const match = await matchesService.getMatch(req.params.matchId, req.user?.userId);
      res.status(200).json({ success: true, match });
    } catch (error) {
      next(error);
    }
  }

  async setReady(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await matchesService.setReady(req.params.matchId, req.user!.userId);
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async rollDice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await matchesService.rollDice(req.params.matchId, req.user!.userId);
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async makeMove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { moves } = req.body;
      const result = await matchesService.makeMove(req.params.matchId, req.user!.userId, moves);
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async forfeit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await matchesService.forfeit(req.params.matchId, req.user!.userId);
      res.status(200).json({ success: true, message: 'Match forfeited' });
    } catch (error) {
      next(error);
    }
  }

  async getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const matches = await matchesService.getMatchHistory(req.user!.userId, limit);
      res.status(200).json({ success: true, matches });
    } catch (error) {
      next(error);
    }
  }
}

export const matchesController = new MatchesController();
```

### Step 3.4: Complete Matches Routes
Create `src/routes/matches.routes.ts`:
```typescript
import { Router } from 'express';
import { matchesController } from '../controllers/matches.controller';
import { authMiddleware, optionalAuth } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { z } from 'zod';

const router = Router();

const makeMoveSchema = z.object({
  moves: z.array(z.object({
    from: z.number().min(-1).max(23),
    to: z.number().min(-1).max(23),
    die_value: z.number().min(1).max(6),
  })).min(1),
});

// Get match (optional auth to check your_color)
router.get('/:matchId', optionalAuth, matchesController.getMatch.bind(matchesController));

// Protected routes
router.use(authMiddleware);

router.get('/user/history', matchesController.getHistory.bind(matchesController));
router.post('/:matchId/ready', matchesController.setReady.bind(matchesController));
router.post('/:matchId/roll', matchesController.rollDice.bind(matchesController));
router.post('/:matchId/move', validateRequest(makeMoveSchema), matchesController.makeMove.bind(matchesController));
router.post('/:matchId/forfeit', matchesController.forfeit.bind(matchesController));

export default router;
```

---

## PHASE 4: Backend Leaderboard System

### Step 4.1: Create Leaderboard Service
Create `src/services/leaderboard.service.ts`:
```typescript
import pool from '../db/connection';

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  username: string;
  avatar_url: string | null;
  level: number;
  wins: number;
  losses: number;
  total_matches: number;
  win_rate: number;
  gold_balance: number;
}

export class LeaderboardService {
  /**
   * Get global leaderboard by wins
   */
  async getGlobalLeaderboard(options: {
    sort_by?: 'wins' | 'level' | 'gold' | 'win_rate';
    limit?: number;
    offset?: number;
  } = {}): Promise<{ leaderboard: LeaderboardEntry[]; total: number }> {
    const sortColumn = {
      wins: 'wins DESC',
      level: 'level DESC, xp DESC',
      gold: 'gold_balance DESC',
      win_rate: '(CASE WHEN total_matches > 0 THEN wins::float / total_matches ELSE 0 END) DESC',
    }[options.sort_by || 'wins'];

    const limit = options.limit || 100;
    const offset = options.offset || 0;

    const query = `
      SELECT 
        user_id,
        username,
        avatar_url,
        level,
        wins,
        losses,
        total_matches,
        gold_balance,
        CASE WHEN total_matches > 0 
          THEN ROUND((wins::float / total_matches * 100)::numeric, 1) 
          ELSE 0 
        END as win_rate,
        ROW_NUMBER() OVER (ORDER BY ${sortColumn}) as rank
      FROM users
      WHERE is_active = TRUE AND is_banned = FALSE AND total_matches > 0
      ORDER BY ${sortColumn}
      LIMIT $1 OFFSET $2
    `;

    const countQuery = `
      SELECT COUNT(*) FROM users 
      WHERE is_active = TRUE AND is_banned = FALSE AND total_matches > 0
    `;

    const [result, countResult] = await Promise.all([
      pool.query(query, [limit, offset]),
      pool.query(countQuery),
    ]);

    return {
      leaderboard: result.rows.map(row => ({
        ...row,
        rank: parseInt(row.rank),
        win_rate: parseFloat(row.win_rate),
      })),
      total: parseInt(countResult.rows[0].count),
    };
  }

  /**
   * Get user's rank
   */
  async getUserRank(userId: string, sortBy: string = 'wins'): Promise<number | null> {
    const sortColumn = {
      wins: 'wins DESC',
      level: 'level DESC',
      gold: 'gold_balance DESC',
    }[sortBy] || 'wins DESC';

    const query = `
      SELECT rank FROM (
        SELECT 
          user_id,
          ROW_NUMBER() OVER (ORDER BY ${sortColumn}) as rank
        FROM users
        WHERE is_active = TRUE AND is_banned = FALSE AND total_matches > 0
      ) ranked
      WHERE user_id = $1
    `;

    const result = await pool.query(query, [userId]);
    return result.rows[0] ? parseInt(result.rows[0].rank) : null;
  }

  /**
   * Get leaderboard around a user
   */
  async getLeaderboardAroundUser(userId: string, range: number = 5): Promise<LeaderboardEntry[]> {
    const userRank = await this.getUserRank(userId);
    if (!userRank) return [];

    const offset = Math.max(0, userRank - range - 1);
    const limit = range * 2 + 1;

    const { leaderboard } = await this.getGlobalLeaderboard({
      sort_by: 'wins',
      limit,
      offset,
    });

    return leaderboard;
  }
}

export const leaderboardService = new LeaderboardService();
```

### Step 4.2: Create Leaderboard Controller & Routes
Create `src/controllers/leaderboard.controller.ts`:
```typescript
import { Request, Response, NextFunction } from 'express';
import { leaderboardService } from '../services/leaderboard.service';

export class LeaderboardController {
  async getGlobal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sort_by, limit, offset } = req.query;
      const result = await leaderboardService.getGlobalLeaderboard({
        sort_by: sort_by as any,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async getUserRank(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rank = await leaderboardService.getUserRank(req.user!.userId);
      res.status(200).json({ success: true, rank });
    } catch (error) {
      next(error);
    }
  }

  async getAroundMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const range = req.query.range ? parseInt(req.query.range as string) : 5;
      const leaderboard = await leaderboardService.getLeaderboardAroundUser(req.user!.userId, range);
      const myRank = await leaderboardService.getUserRank(req.user!.userId);
      res.status(200).json({ success: true, leaderboard, my_rank: myRank });
    } catch (error) {
      next(error);
    }
  }
}

export const leaderboardController = new LeaderboardController();
```

Create `src/routes/leaderboard.routes.ts`:
```typescript
import { Router } from 'express';
import { leaderboardController } from '../controllers/leaderboard.controller';
import { authMiddleware, optionalAuth } from '../middleware/auth.middleware';

const router = Router();

router.get('/', optionalAuth, leaderboardController.getGlobal.bind(leaderboardController));
router.get('/me', authMiddleware, leaderboardController.getUserRank.bind(leaderboardController));
router.get('/around-me', authMiddleware, leaderboardController.getAroundMe.bind(leaderboardController));

export default router;
```

### Step 4.3: Add Leaderboard to Routes Index
Add to `src/routes/index.ts`:
```typescript
import leaderboardRoutes from './leaderboard.routes';
// ...
router.use('/leaderboard', leaderboardRoutes);
```

---

## PHASE 5: Backend Chat Persistence

### Step 5.1: Create Chat Repository
Create `src/repositories/chat.repository.ts`:
```typescript
import pool from '../db/connection';

export interface ChatMessage {
  message_id: string;
  club_id: string;
  user_id: string | null;
  username: string;
  message: string;
  message_type: 'text' | 'system' | 'emote';
  created_at: Date;
}

export class ChatRepository {
  async saveMessage(data: {
    club_id: string;
    user_id: string;
    username: string;
    message: string;
    message_type?: 'text' | 'system' | 'emote';
  }): Promise<ChatMessage> {
    const query = `
      INSERT INTO chat_messages (club_id, user_id, username, message, message_type)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const result = await pool.query(query, [
      data.club_id,
      data.user_id,
      data.username,
      data.message.substring(0, 1000), // Limit message length
      data.message_type || 'text',
    ]);
    return result.rows[0];
  }

  async getMessages(clubId: string, options: {
    limit?: number;
    before?: Date;
  } = {}): Promise<ChatMessage[]> {
    let query = `
      SELECT * FROM chat_messages
      WHERE club_id = $1
    `;
    const values: any[] = [clubId];

    if (options.before) {
      query += ` AND created_at < $2`;
      values.push(options.before);
    }

    query += ` ORDER BY created_at DESC LIMIT $${values.length + 1}`;
    values.push(options.limit || 50);

    const result = await pool.query(query, values);
    return result.rows.reverse(); // Return in chronological order
  }
}

export const chatRepository = new ChatRepository();
```

### Step 5.2: Update WebSocket to Persist Chat
Update `src/websocket/index.ts` - add to the `club_chat_message` handler:
```typescript
import { chatRepository } from '../repositories/chat.repository';
import { usersRepository } from '../repositories/users.repository';

// Inside the connection handler, update the club_chat_message handler:
socket.on('club_chat_message', async ({ club_id, message }) => {
  const userId = socket.data.userId;
  
  // Get username
  const user = await usersRepository.findById(userId);
  if (!user) return;

  // Sanitize message (basic XSS prevention)
  const sanitizedMessage = message
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .substring(0, 1000);

  // Save to database
  const savedMessage = await chatRepository.saveMessage({
    club_id,
    user_id: userId,
    username: user.username,
    message: sanitizedMessage,
  });

  // Emit to all club members
  io.to(`club:${club_id}`).emit('club_chat_message', {
    club_id,
    message: {
      message_id: savedMessage.message_id,
      user_id: userId,
      username: user.username,
      message: sanitizedMessage,
      timestamp: savedMessage.created_at.toISOString(),
    },
  });
});
```

### Step 5.3: Add Chat History Endpoint to Clubs
Add to `src/controllers/clubs.controller.ts`:
```typescript
async getChatHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const messages = await chatRepository.getMessages(req.params.clubId, {
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
    });
    res.status(200).json({ success: true, messages });
  } catch (error) {
    next(error);
  }
}
```

Add route in `src/routes/clubs.routes.ts`:
```typescript
router.get('/:clubId/chat', authMiddleware, clubsController.getChatHistory.bind(clubsController));
```

---

## PHASE 6: Frontend Match Screen

### Step 6.1: Create Match Store
Create `store/matchStore.ts`:
```typescript
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
```

### Step 6.2: Create Match API Service
Create `services/api/matchApi.ts`:
```typescript
import apiClient from './axiosInstance';
import { GameState, Move } from '../../types/game.types';

export const matchApi = {
  getMatch: (matchId: string) =>
    apiClient.get<{ success: boolean; match: any }>(`/matches/${matchId}`),

  setReady: (matchId: string) =>
    apiClient.post<{ success: boolean; both_ready: boolean; game_state?: GameState }>(
      `/matches/${matchId}/ready`
    ),

  rollDice: (matchId: string) =>
    apiClient.post<{ success: boolean; dice: any[]; legal_moves: Move[] }>(
      `/matches/${matchId}/roll`
    ),

  makeMove: (matchId: string, moves: Move[]) =>
    apiClient.post<{
      success: boolean;
      game_state: GameState;
      legal_moves: Move[];
      turn_complete: boolean;
      game_over: boolean;
      winner?: string;
    }>(`/matches/${matchId}/move`, { moves }),

  forfeit: (matchId: string) =>
    apiClient.post<{ success: boolean }>(`/matches/${matchId}/forfeit`),

  getHistory: (limit?: number) =>
    apiClient.get<{ success: boolean; matches: any[] }>('/matches/user/history', {
      params: { limit },
    }),
};
```

### Step 6.3: Create Matchmaking API
Create `services/api/matchmakingApi.ts`:
```typescript
import apiClient from './axiosInstance';

export const matchmakingApi = {
  joinQueue: (stakeAmount: number, matchType?: 'gold' | 'club', clubId?: string) =>
    apiClient.post<{
      success: boolean;
      matched: boolean;
      match_id?: string;
      opponent?: { user_id: string; username: string; level: number; wins: number };
      queue_position?: number;
      estimated_wait?: number;
    }>('/matchmaking/join', {
      stake_amount: stakeAmount,
      match_type: matchType,
      club_id: clubId,
    }),

  leaveQueue: () =>
    apiClient.post<{ success: boolean; cancelled: boolean }>('/matchmaking/leave'),

  getStatus: () =>
    apiClient.get<{
      success: boolean;
      in_queue: boolean;
      position?: number;
      stake_amount?: number;
    }>('/matchmaking/status'),
};
```

### Step 6.4: Create Match Screen
Create `app/match/[id].tsx`:
```typescript
import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Polygon, Circle, Rect, G, Text as SvgText } from 'react-native-svg';
import { useMatchStore } from '../../store/matchStore';
import { useAuthStore } from '../../store/authStore';
import { matchApi } from '../../services/api/matchApi';
import { wsService } from '../../services/websocket';
import { GameState, Move, Color, Point } from '../../types/game.types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BOARD_WIDTH = SCREEN_WIDTH - 32;
const BOARD_HEIGHT = BOARD_WIDTH * 0.8;
const POINT_WIDTH = (BOARD_WIDTH - 40) / 12; // 12 points visible, minus bar
const POINT_HEIGHT = BOARD_HEIGHT * 0.38;
const BAR_WIDTH = 30;

export default function MatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  
  const {
    matchId,
    myColor,
    opponent,
    gameState,
    legalMoves,
    selectedPoint,
    isMyTurn,
    isReady,
    opponentReady,
    matchStatus,
    setMatch,
    setGameState,
    setLegalMoves,
    setSelectedPoint,
    setReady,
    setOpponentReady,
    setMatchStatus,
    clearMatch,
  } = useMatchStore();

  const [loading, setLoading] = useState(true);
  const [rolling, setRolling] = useState(false);
  const [pendingMoves, setPendingMoves] = useState<Move[]>([]);

  // Load match data
  useEffect(() => {
    if (!id) return;
    
    const loadMatch = async () => {
      try {
        const { data } = await matchApi.getMatch(id);
        const match = data.match;
        
        setMatch({
          matchId: id,
          matchType: match.match_type,
          stakeAmount: match.stake_amount,
          myColor: match.your_color,
          opponent: {
            user_id: match.your_color === 'white' ? match.player_black_id : match.player_white_id,
            username: match.your_color === 'white' ? match.player_black_username : match.player_white_username,
          },
        });
        
        if (match.game_state) {
          setGameState(match.game_state);
        }
        
        setMatchStatus(match.status);
        setReady(match.your_color === 'white' ? match.player_white_ready : match.player_black_ready);
        setOpponentReady(match.your_color === 'white' ? match.player_black_ready : match.player_white_ready);
        
      } catch (error) {
        console.error('Failed to load match:', error);
        Alert.alert('Error', 'Failed to load match');
        router.back();
      } finally {
        setLoading(false);
      }
    };

    loadMatch();

    // Join match room
    wsService.joinMatch(id);

    return () => {
      wsService.leaveMatch(id);
      clearMatch();
    };
  }, [id]);

  // WebSocket event listeners
  useEffect(() => {
    const unsubReady = wsService.on('player_ready_status', (data: any) => {
      if (data.match_id === id && data.user_id !== user?.user_id) {
        setOpponentReady(data.ready);
      }
    });

    const unsubStarted = wsService.on('match_started', (data: any) => {
      if (data.match_id === id) {
        setGameState(data.game_state);
        setMatchStatus('in_progress');
      }
    });

    const unsubTurn = wsService.on('turn_changed', (data: any) => {
      if (data.match_id === id && data.current_turn !== myColor) {
        // Opponent's turn, update dice display
        setGameState((prev: GameState) => ({ ...prev!, dice: data.dice }));
      }
    });

    const unsubMove = wsService.on('move_made', (data: any) => {
      if (data.match_id === id) {
        setGameState(data.game_state);
        if (data.turn_complete && data.game_state.current_turn === myColor) {
          // Now my turn
          setLegalMoves([]);
        }
      }
    });

    const unsubComplete = wsService.on('match_completed', (data: any) => {
      if (data.match_id === id) {
        setMatchStatus('completed');
        const won = data.winner === user?.user_id;
        Alert.alert(
          won ? '🎉 Victory!' : '😔 Defeat',
          won ? 'You won the match!' : 'Better luck next time!',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      }
    });

    return () => {
      unsubReady();
      unsubStarted();
      unsubTurn();
      unsubMove();
      unsubComplete();
    };
  }, [id, myColor, user]);

  // Handle ready
  const handleReady = async () => {
    try {
      const { data } = await matchApi.setReady(id!);
      setReady(true);
      
      if (data.both_ready && data.game_state) {
        setGameState(data.game_state);
        setMatchStatus('in_progress');
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to set ready');
    }
  };

  // Handle roll dice
  const handleRoll = async () => {
    if (!isMyTurn || rolling) return;
    
    setRolling(true);
    try {
      const { data } = await matchApi.rollDice(id!);
      setGameState((prev: GameState) => ({ ...prev!, dice: data.dice }));
      setLegalMoves(data.legal_moves);
      setPendingMoves([]);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to roll dice');
    } finally {
      setRolling(false);
    }
  };

  // Handle point press
  const handlePointPress = (pointIndex: number) => {
    if (!isMyTurn || !gameState) return;

    const point = gameState.board[pointIndex];

    if (selectedPoint === null) {
      // Select a piece
      if (point.color === myColor && point.pieces > 0) {
        const hasLegalMove = legalMoves.some(m => m.from === pointIndex);
        if (hasLegalMove) {
          setSelectedPoint(pointIndex);
        }
      }
    } else {
      // Try to move
      const move = legalMoves.find(
        m => m.from === selectedPoint && m.to === pointIndex
      );
      
      if (move) {
        executeMoves([...pendingMoves, move]);
      }
      setSelectedPoint(null);
    }
  };

  // Execute moves
  const executeMoves = async (moves: Move[]) => {
    try {
      const { data } = await matchApi.makeMove(id!, moves);
      setGameState(data.game_state);
      setLegalMoves(data.legal_moves);
      setPendingMoves([]);
      
      if (data.game_over) {
        setMatchStatus('completed');
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Invalid move');
    }
  };

  // Handle forfeit
  const handleForfeit = () => {
    Alert.alert(
      'Forfeit Match',
      'Are you sure you want to forfeit? You will lose the stake.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Forfeit',
          style: 'destructive',
          onPress: async () => {
            try {
              await matchApi.forfeit(id!);
              router.back();
            } catch (error) {
              Alert.alert('Error', 'Failed to forfeit');
            }
          },
        },
      ]
    );
  };

  // Render board point
  const renderPoint = (index: number, isTop: boolean) => {
    if (!gameState) return null;
    
    // Calculate x position (accounting for bar in middle)
    let xPos: number;
    if (isTop) {
      // Top row: 12-7 on left, 6-1 on right
      if (index >= 12 && index <= 17) {
        xPos = (17 - index) * POINT_WIDTH + 5;
      } else {
        xPos = (23 - index) * POINT_WIDTH + BAR_WIDTH + 5;
      }
    } else {
      // Bottom row: 1-6 on left, 7-12 on right  
      if (index >= 0 && index <= 5) {
        xPos = index * POINT_WIDTH + 5;
      } else {
        xPos = (index - 6) * POINT_WIDTH + BAR_WIDTH + 5;
      }
    }

    const isLight = index % 2 === 0;
    const point = gameState.board[index];
    const isSelected = selectedPoint === index;
    const isLegalDestination = selectedPoint !== null && 
      legalMoves.some(m => m.from === selectedPoint && m.to === index);

    return (
      <G key={index}>
        <Polygon
          points={
            isTop
              ? `${xPos},0 ${xPos + POINT_WIDTH},0 ${xPos + POINT_WIDTH / 2},${POINT_HEIGHT}`
              : `${xPos},${BOARD_HEIGHT} ${xPos + POINT_WIDTH},${BOARD_HEIGHT} ${xPos + POINT_WIDTH / 2},${BOARD_HEIGHT - POINT_HEIGHT}`
          }
          fill={isLight ? '#D4A574' : '#8B5A2B'}
          stroke={isSelected ? '#FFD700' : isLegalDestination ? '#00FF00' : 'transparent'}
          strokeWidth={isSelected || isLegalDestination ? 3 : 0}
          onPress={() => handlePointPress(index)}
        />

        {/* Pieces */}
        {point.pieces > 0 && Array.from({ length: Math.min(point.pieces, 5) }).map((_, i) => {
          const pieceY = isTop ? 12 + i * 24 : BOARD_HEIGHT - 12 - i * 24;
          return (
            <Circle
              key={i}
              cx={xPos + POINT_WIDTH / 2}
              cy={pieceY}
              r={11}
              fill={point.color === 'white' ? '#F5F5DC' : '#2F2F2F'}
              stroke={point.color === 'white' ? '#666' : '#888'}
              strokeWidth={1}
              onPress={() => handlePointPress(index)}
            />
          );
        })}

        {/* Count for stacked pieces */}
        {point.pieces > 5 && (
          <SvgText
            x={xPos + POINT_WIDTH / 2}
            y={isTop ? 85 : BOARD_HEIGHT - 80}
            fontSize="12"
            fontWeight="bold"
            fill={point.color === 'white' ? '#000' : '#FFF'}
            textAnchor="middle"
          >
            {point.pieces}
          </SvgText>
        )}
      </G>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>Loading match...</Text>
      </View>
    );
  }

  // Ready screen
  if (matchStatus === 'ready' || matchStatus === 'waiting') {
    return (
      <>
        <Stack.Screen options={{ headerTitle: 'Match' }} />
        <View style={styles.readyContainer}>
          <Text style={styles.readyTitle}>Match Found!</Text>
          <Text style={styles.opponentName}>vs {opponent?.username}</Text>
          <Text style={styles.stakeText}>🪙 {useMatchStore.getState().stakeAmount} gold</Text>
          
          <View style={styles.readyStatus}>
            <View style={styles.playerStatus}>
              <Text style={styles.playerName}>You</Text>
              <Ionicons 
                name={isReady ? 'checkmark-circle' : 'ellipse-outline'} 
                size={32} 
                color={isReady ? '#10B981' : '#ccc'} 
              />
            </View>
            <View style={styles.playerStatus}>
              <Text style={styles.playerName}>{opponent?.username}</Text>
              <Ionicons 
                name={opponentReady ? 'checkmark-circle' : 'ellipse-outline'} 
                size={32} 
                color={opponentReady ? '#10B981' : '#ccc'} 
              />
            </View>
          </View>

          {!isReady ? (
            <TouchableOpacity style={styles.readyButton} onPress={handleReady}>
              <Text style={styles.readyButtonText}>I'm Ready!</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.waitingText}>Waiting for opponent...</Text>
          )}
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen 
        options={{ 
          headerTitle: `vs ${opponent?.username}`,
          headerRight: () => (
            <TouchableOpacity onPress={handleForfeit}>
              <Ionicons name="flag-outline" size={24} color="#DC2626" />
            </TouchableOpacity>
          ),
        }} 
      />
      <View style={styles.container}>
        {/* Opponent info */}
        <View style={styles.playerBar}>
          <Text style={styles.playerBarName}>{opponent?.username}</Text>
          <Text style={styles.playerBarColor}>
            {myColor === 'white' ? '⚫ Black' : '⚪ White'}
          </Text>
        </View>

        {/* Board */}
        <View style={styles.boardContainer}>
          <Svg width={BOARD_WIDTH} height={BOARD_HEIGHT}>
            {/* Board background */}
            <Rect x={0} y={0} width={BOARD_WIDTH} height={BOARD_HEIGHT} fill="#5D4037" rx={8} />
            
            {/* Bar */}
            <Rect 
              x={BOARD_WIDTH / 2 - BAR_WIDTH / 2} 
              y={0} 
              width={BAR_WIDTH} 
              height={BOARD_HEIGHT} 
              fill="#3E2723" 
            />

            {/* Render points */}
            {/* Top row: 13-24 (indices 12-23) */}
            {[12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23].map(i => renderPoint(i, true))}
            {/* Bottom row: 1-12 (indices 0-11) */}
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => renderPoint(i, false))}
          </Svg>
        </View>

        {/* Your info */}
        <View style={[styles.playerBar, styles.playerBarBottom]}>
          <Text style={styles.playerBarName}>You</Text>
          <Text style={styles.playerBarColor}>
            {myColor === 'white' ? '⚪ White' : '⚫ Black'}
          </Text>
        </View>

        {/* Dice & Controls */}
        <View style={styles.controls}>
          {/* Dice display */}
          <View style={styles.diceContainer}>
            {gameState?.dice.map((die, i) => (
              <View key={i} style={[styles.die, die.used && styles.dieUsed]}>
                <Text style={styles.dieText}>{die.value}</Text>
              </View>
            ))}
          </View>

          {/* Turn indicator & roll button */}
          {isMyTurn ? (
            gameState?.dice.every(d => d.used) || gameState?.dice.length === 0 ? (
              <TouchableOpacity 
                style={[styles.rollButton, rolling && styles.rollButtonDisabled]}
                onPress={handleRoll}
                disabled={rolling}
              >
                {rolling ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.rollButtonText}>🎲 Roll Dice</Text>
                )}
              </TouchableOpacity>
            ) : (
              <Text style={styles.turnText}>Your turn - make your move!</Text>
            )
          ) : (
            <Text style={styles.turnText}>Opponent's turn...</Text>
          )}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' },
  loadingText: { marginTop: 16, fontSize: 16, color: '#666' },
  readyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5', padding: 24 },
  readyTitle: { fontSize: 28, fontWeight: 'bold', color: '#333' },
  opponentName: { fontSize: 20, color: '#666', marginTop: 8 },
  stakeText: { fontSize: 18, color: '#F9A825', marginTop: 16, fontWeight: '600' },
  readyStatus: { flexDirection: 'row', gap: 48, marginTop: 32 },
  playerStatus: { alignItems: 'center', gap: 8 },
  playerName: { fontSize: 16, color: '#333' },
  readyButton: { backgroundColor: '#10B981', paddingHorizontal: 48, paddingVertical: 16, borderRadius: 12, marginTop: 32 },
  readyButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  waitingText: { marginTop: 32, fontSize: 16, color: '#666' },
  container: { flex: 1, backgroundColor: '#2D2D2D' },
  playerBar: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, backgroundColor: '#1a1a1a' },
  playerBarBottom: { backgroundColor: '#333' },
  playerBarName: { color: 'white', fontSize: 16, fontWeight: '600' },
  playerBarColor: { color: '#aaa', fontSize: 14 },
  boardContainer: { alignItems: 'center', padding: 16 },
  controls: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  diceContainer: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  die: { width: 50, height: 50, backgroundColor: 'white', borderRadius: 8, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5 },
  dieUsed: { opacity: 0.3 },
  dieText: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  rollButton: { backgroundColor: '#667eea', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 12 },
  rollButtonDisabled: { opacity: 0.7 },
  rollButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  turnText: { color: 'white', fontSize: 16 },
});
```

---

## PHASE 7: Frontend Create Club Screen

### Step 7.1: Create Club Creation Screen
Create `app/club/create.tsx`:
```typescript
import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useClubStore } from '../../store/clubStore';
import { useAuthStore } from '../../store/authStore';

const CLUB_CREATION_COST = 50000;

export default function CreateClubScreen() {
  const router = useRouter();
  const { createClub } = useClubStore();
  const user = useAuthStore((state) => state.user);
  const updateGoldBalance = useAuthStore((state) => state.updateGoldBalance);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [welcomeBonus, setWelcomeBonus] = useState('1000');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const canAfford = (user?.gold_balance || 0) >= CLUB_CREATION_COST;

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Club name is required';
    } else if (name.trim().length < 3) {
      newErrors.name = 'Name must be at least 3 characters';
    } else if (name.trim().length > 50) {
      newErrors.name = 'Name must be at most 50 characters';
    }

    const bonus = parseInt(welcomeBonus) || 0;
    if (bonus < 0 || bonus > 100000) {
      newErrors.welcomeBonus = 'Welcome bonus must be 0-100,000';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreate = async () => {
    if (!validate()) return;
    if (!canAfford) {
      Alert.alert('Insufficient Gold', `You need ${CLUB_CREATION_COST.toLocaleString()} gold to create a club.`);
      return;
    }

    setLoading(true);
    try {
      const club = await createClub({
        name: name.trim(),
        description: description.trim() || undefined,
        privacy: isPrivate ? 'private' : 'public',
        welcome_bonus: parseInt(welcomeBonus) || 0,
      });

      // Update gold balance locally
      updateGoldBalance((user?.gold_balance || 0) - CLUB_CREATION_COST);

      Alert.alert('Success!', `"${club.name}" has been created!`, [
        { text: 'View Club', onPress: () => router.replace(`/club/${club.club_id}`) },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to create club');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerTitle: 'Create Club' }} />
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        {/* Cost Warning */}
        <View style={[styles.costCard, !canAfford && styles.costCardError]}>
          <Ionicons 
            name={canAfford ? 'information-circle' : 'warning'} 
            size={24} 
            color={canAfford ? '#667eea' : '#DC2626'} 
          />
          <View style={styles.costInfo}>
            <Text style={styles.costTitle}>Creation Cost</Text>
            <Text style={[styles.costAmount, !canAfford && styles.costAmountError]}>
              🪙 {CLUB_CREATION_COST.toLocaleString()} gold
            </Text>
            <Text style={styles.costBalance}>
              Your balance: {(user?.gold_balance || 0).toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Club Name *</Text>
            <TextInput
              style={[styles.input, errors.name && styles.inputError]}
              placeholder="Enter club name"
              placeholderTextColor="#999"
              value={name}
              onChangeText={setName}
              maxLength={50}
              autoCapitalize="words"
            />
            {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Tell people about your club..."
              placeholderTextColor="#999"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              maxLength={500}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.switchRow}>
            <View>
              <Text style={styles.label}>Private Club</Text>
              <Text style={styles.switchHint}>
                {isPrivate ? 'Members need approval to join' : 'Anyone can join'}
              </Text>
            </View>
            <Switch
              value={isPrivate}
              onValueChange={setIsPrivate}
              trackColor={{ false: '#ddd', true: '#667eea' }}
              thumbColor="white"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Welcome Bonus (chips)</Text>
            <TextInput
              style={[styles.input, errors.welcomeBonus && styles.inputError]}
              placeholder="0"
              placeholderTextColor="#999"
              value={welcomeBonus}
              onChangeText={setWelcomeBonus}
              keyboardType="number-pad"
              maxLength={6}
            />
            <Text style={styles.hint}>Chips given to new members when they join</Text>
            {errors.welcomeBonus && <Text style={styles.errorText}>{errors.welcomeBonus}</Text>}
          </View>
        </View>

        {/* Create Button */}
        <TouchableOpacity
          style={[styles.createButton, (!canAfford || loading) && styles.createButtonDisabled]}
          onPress={handleCreate}
          disabled={!canAfford || loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Ionicons name="add-circle" size={24} color="white" />
              <Text style={styles.createButtonText}>Create Club</Text>
            </>
          )}
        </TouchableOpacity>

        {!canAfford && (
          <TouchableOpacity 
            style={styles.buyGoldButton}
            onPress={() => router.push('/(tabs)/shop')}
          >
            <Text style={styles.buyGoldText}>Buy More Gold</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  costCard: { 
    flexDirection: 'row', 
    backgroundColor: '#EEF2FF', 
    margin: 16, 
    padding: 16, 
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  costCardError: { backgroundColor: '#FEE2E2', borderColor: '#FECACA' },
  costInfo: { marginLeft: 12, flex: 1 },
  costTitle: { fontSize: 14, color: '#666' },
  costAmount: { fontSize: 20, fontWeight: 'bold', color: '#667eea', marginTop: 4 },
  costAmountError: { color: '#DC2626' },
  costBalance: { fontSize: 12, color: '#999', marginTop: 4 },
  form: { padding: 16, gap: 20 },
  inputGroup: { gap: 6 },
  label: { fontSize: 14, fontWeight: '600', color: '#333' },
  input: { 
    backgroundColor: 'white', 
    paddingHorizontal: 16, 
    paddingVertical: 14, 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: '#ddd', 
    fontSize: 16,
    color: '#333',
  },
  inputError: { borderColor: '#DC2626' },
  textArea: { height: 100, paddingTop: 14 },
  hint: { fontSize: 12, color: '#999', marginTop: 4 },
  errorText: { fontSize: 12, color: '#DC2626', marginTop: 4 },
  switchRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
  },
  switchHint: { fontSize: 12, color: '#666', marginTop: 4 },
  createButton: { 
    flexDirection: 'row',
    backgroundColor: '#667eea', 
    marginHorizontal: 16, 
    padding: 18, 
    borderRadius: 12, 
    alignItems: 'center', 
    justifyContent: 'center',
    gap: 8,
  },
  createButtonDisabled: { backgroundColor: '#ccc' },
  createButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  buyGoldButton: { alignItems: 'center', marginTop: 16 },
  buyGoldText: { color: '#667eea', fontSize: 16, fontWeight: '600' },
});
```

---

## PHASE 8: Frontend Leaderboard Tab

### Step 8.1: Create Leaderboard API
Create `services/api/leaderboardApi.ts`:
```typescript
import apiClient from './axiosInstance';

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  username: string;
  avatar_url: string | null;
  level: number;
  wins: number;
  losses: number;
  total_matches: number;
  win_rate: number;
  gold_balance: number;
}

export const leaderboardApi = {
  getGlobal: (sortBy?: string, limit?: number, offset?: number) =>
    apiClient.get<{
      success: boolean;
      leaderboard: LeaderboardEntry[];
      total: number;
    }>('/leaderboard', {
      params: { sort_by: sortBy, limit, offset },
    }),

  getMyRank: () =>
    apiClient.get<{ success: boolean; rank: number | null }>('/leaderboard/me'),

  getAroundMe: (range?: number) =>
    apiClient.get<{
      success: boolean;
      leaderboard: LeaderboardEntry[];
      my_rank: number;
    }>('/leaderboard/around-me', { params: { range } }),
};
```

### Step 8.2: Update Leaderboard Tab
Replace `app/(tabs)/leaderboard.tsx`:
```typescript
import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { leaderboardApi, LeaderboardEntry } from '../../services/api/leaderboardApi';

type SortType = 'wins' | 'level' | 'gold' | 'win_rate';

export default function LeaderboardTab() {
  const user = useAuthStore((state) => state.user);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<SortType>('wins');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLeaderboard = async () => {
    try {
      const [globalRes, rankRes] = await Promise.all([
        leaderboardApi.getGlobal(sortBy, 100),
        leaderboardApi.getMyRank(),
      ]);
      setLeaderboard(globalRes.data.leaderboard);
      setMyRank(rankRes.data.rank);
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchLeaderboard();
  }, [sortBy]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchLeaderboard();
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return '#FFD700';
    if (rank === 2) return '#C0C0C0';
    if (rank === 3) return '#CD7F32';
    return '#666';
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  const renderItem = ({ item }: { item: LeaderboardEntry }) => {
    const isMe = item.user_id === user?.user_id;
    
    return (
      <View style={[styles.row, isMe && styles.rowHighlight]}>
        <Text style={[styles.rank, { color: getRankColor(item.rank) }]}>
          {getRankIcon(item.rank)}
        </Text>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {item.username.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.info}>
          <Text style={[styles.username, isMe && styles.usernameMe]}>
            {item.username} {isMe && '(You)'}
          </Text>
          <Text style={styles.stats}>
            Level {item.level} • {item.win_rate}% win rate
          </Text>
        </View>
        <View style={styles.score}>
          <Text style={styles.scoreValue}>
            {sortBy === 'wins' && item.wins}
            {sortBy === 'level' && item.level}
            {sortBy === 'gold' && `${(item.gold_balance / 1000).toFixed(0)}K`}
            {sortBy === 'win_rate' && `${item.win_rate}%`}
          </Text>
          <Text style={styles.scoreLabel}>
            {sortBy === 'wins' && 'wins'}
            {sortBy === 'level' && 'level'}
            {sortBy === 'gold' && 'gold'}
            {sortBy === 'win_rate' && 'rate'}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* My Rank Card */}
      {myRank && (
        <View style={styles.myRankCard}>
          <Text style={styles.myRankLabel}>Your Rank</Text>
          <Text style={styles.myRankValue}>#{myRank}</Text>
        </View>
      )}

      {/* Sort Tabs */}
      <View style={styles.sortTabs}>
        {(['wins', 'level', 'gold', 'win_rate'] as SortType[]).map((type) => (
          <TouchableOpacity
            key={type}
            style={[styles.sortTab, sortBy === type && styles.sortTabActive]}
            onPress={() => setSortBy(type)}
          >
            <Text style={[styles.sortTabText, sortBy === type && styles.sortTabTextActive]}>
              {type === 'win_rate' ? 'Win %' : type.charAt(0).toUpperCase() + type.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Leaderboard List */}
      <FlatList
        data={leaderboard}
        keyExtractor={(item) => item.user_id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="trophy-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>No rankings yet</Text>
            <Text style={styles.emptySubtext}>Play some matches to appear here!</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  myRankCard: {
    backgroundColor: '#667eea',
    margin: 16,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  myRankLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  myRankValue: { color: 'white', fontSize: 36, fontWeight: 'bold', marginTop: 4 },
  sortTabs: {
    flexDirection: 'row',
    backgroundColor: 'white',
    marginHorizontal: 16,
    borderRadius: 8,
    padding: 4,
  },
  sortTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 6 },
  sortTabActive: { backgroundColor: '#667eea' },
  sortTabText: { fontSize: 12, fontWeight: '600', color: '#666' },
  sortTabTextActive: { color: 'white' },
  list: { padding: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  rowHighlight: { backgroundColor: '#EEF2FF', borderWidth: 1, borderColor: '#667eea' },
  rank: { width: 40, fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  info: { flex: 1 },
  username: { fontSize: 14, fontWeight: '600', color: '#333' },
  usernameMe: { color: '#667eea' },
  stats: { fontSize: 11, color: '#666', marginTop: 2 },
  score: { alignItems: 'flex-end' },
  scoreValue: { fontSize: 18, fontWeight: 'bold', color: '#667eea' },
  scoreLabel: { fontSize: 10, color: '#999' },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 16, color: '#666', marginTop: 12 },
  emptySubtext: { fontSize: 12, color: '#999', marginTop: 4 },
});
```

---

## PHASE 9: Quick Match Integration

### Step 9.1: Update Play Tab with Matchmaking
Update the Quick Match button in `app/(tabs)/index.tsx`:
```typescript
import { useState } from 'react';
import { Alert, Modal, TextInput } from 'react-native';
import { matchmakingApi } from '../../services/api/matchmakingApi';

// Inside PlayTab component, add state:
const [showStakeModal, setShowStakeModal] = useState(false);
const [stake, setStake] = useState('100');
const [searching, setSearching] = useState(false);

// Add matchmaking handler:
const handleQuickMatch = async () => {
  const stakeAmount = parseInt(stake) || 100;
  
  if (stakeAmount > (user?.gold_balance || 0)) {
    Alert.alert('Insufficient Gold', 'You don\'t have enough gold for this stake.');
    return;
  }

  setSearching(true);
  setShowStakeModal(false);

  try {
    const { data } = await matchmakingApi.joinQueue(stakeAmount);
    
    if (data.matched) {
      // Match found immediately!
      router.push(`/match/${data.match_id}`);
    } else {
      // In queue, wait for match
      Alert.alert(
        'Searching for opponent...',
        `Position: #${data.queue_position}\nEstimated wait: ${data.estimated_wait}s`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: async () => {
              await matchmakingApi.leaveQueue();
              setSearching(false);
            },
          },
        ]
      );
    }
  } catch (error: any) {
    Alert.alert('Error', error.response?.data?.error || 'Failed to join queue');
    setSearching(false);
  }
};

// Update the Quick Match button onPress:
onPress={() => setShowStakeModal(true)}

// Add stake selection modal (inside the return, before closing </ScrollView>):
<Modal
  visible={showStakeModal}
  transparent
  animationType="slide"
  onRequestClose={() => setShowStakeModal(false)}
>
  <View style={styles.modalOverlay}>
    <View style={styles.modalContent}>
      <Text style={styles.modalTitle}>Quick Match</Text>
      <Text style={styles.modalSubtitle}>Choose your stake amount</Text>
      
      <View style={styles.stakeOptions}>
        {[100, 500, 1000, 5000].map((amount) => (
          <TouchableOpacity
            key={amount}
            style={[styles.stakeOption, stake === String(amount) && styles.stakeOptionSelected]}
            onPress={() => setStake(String(amount))}
          >
            <Text style={[styles.stakeOptionText, stake === String(amount) && styles.stakeOptionTextSelected]}>
              🪙 {amount}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      
      <TextInput
        style={styles.stakeInput}
        placeholder="Or enter custom amount"
        value={stake}
        onChangeText={setStake}
        keyboardType="number-pad"
      />
      
      <TouchableOpacity style={styles.findMatchButton} onPress={handleQuickMatch}>
        <Text style={styles.findMatchButtonText}>Find Match</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.cancelButton} onPress={() => setShowStakeModal(false)}>
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  </View>
</Modal>

// Add these styles:
modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
modalContent: { backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
modalTitle: { fontSize: 24, fontWeight: 'bold', textAlign: 'center' },
modalSubtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginTop: 8, marginBottom: 24 },
stakeOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
stakeOption: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8, borderWidth: 2, borderColor: '#ddd' },
stakeOptionSelected: { borderColor: '#667eea', backgroundColor: '#EEF2FF' },
stakeOptionText: { fontSize: 16, color: '#666' },
stakeOptionTextSelected: { color: '#667eea', fontWeight: '600' },
stakeInput: { backgroundColor: '#f5f5f5', padding: 16, borderRadius: 12, marginTop: 16, fontSize: 16, textAlign: 'center' },
findMatchButton: { backgroundColor: '#667eea', padding: 18, borderRadius: 12, marginTop: 24 },
findMatchButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
cancelButton: { marginTop: 12, padding: 12 },
cancelButtonText: { color: '#666', fontSize: 16, textAlign: 'center' },
```

---

## PHASE 10: Final Routes Update

### Step 10.1: Complete Routes Index
Ensure `src/routes/index.ts` has ALL routes:
```typescript
import { Router } from 'express';
import authRoutes from './auth.routes';
import goldRoutes from './gold.routes';
import clubsRoutes from './clubs.routes';
import matchesRoutes from './matches.routes';
import matchmakingRoutes from './matchmaking.routes';
import leaderboardRoutes from './leaderboard.routes';

const router = Router();

router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

router.use('/auth', authRoutes);
router.use('/gold', goldRoutes);
router.use('/clubs', clubsRoutes);
router.use('/matches', matchesRoutes);
router.use('/matchmaking', matchmakingRoutes);
router.use('/leaderboard', leaderboardRoutes);

export default router;
```

---

## ✅ LANE 7 COMPLETION CHECKLIST

### Database
- [ ] matchmaking_queue table created
- [ ] chat_messages table created
- [ ] notifications table created
- [ ] match_moves table created
- [ ] All indexes created

### Backend - Matchmaking
- [ ] Matchmaking types defined
- [ ] Matchmaking repository complete
- [ ] Matchmaking service with queue processor
- [ ] Matchmaking controller complete
- [ ] Matchmaking routes added

### Backend - Matches
- [ ] Matches repository complete
- [ ] Matches service with full game flow
- [ ] Gold/chip transfer on match end
- [ ] User stats update on match end
- [ ] Matches controller complete
- [ ] Matches routes added

### Backend - Leaderboard
- [ ] Leaderboard service complete
- [ ] Multiple sort options (wins, level, gold, win_rate)
- [ ] User rank calculation
- [ ] Leaderboard routes added

### Backend - Chat
- [ ] Chat repository for persistence
- [ ] WebSocket updated to save messages
- [ ] Chat history endpoint added

### Frontend - Match Screen
- [ ] Match store created
- [ ] Match API service created
- [ ] Match screen with board rendering
- [ ] Ready screen flow
- [ ] Dice rolling
- [ ] Move execution
- [ ] Game completion handling

### Frontend - Other Screens
- [ ] Create club screen complete
- [ ] Leaderboard tab complete
- [ ] Quick match modal in Play tab
- [ ] Matchmaking API integration

### Integration
- [ ] All routes registered in index
- [ ] WebSocket events wired correctly
- [ ] End-to-end game flow works

**When all items are checked, MVP IS 100% COMPLETE!**

---

## 📁 FILES CREATED IN LANE 7

### Backend
```
src/
├── types/
│   └── matchmaking.types.ts
├── repositories/
│   ├── matchmaking.repository.ts
│   ├── matches.repository.ts (complete)
│   └── chat.repository.ts
├── services/
│   ├── matchmaking.service.ts
│   ├── matches.service.ts (complete)
│   └── leaderboard.service.ts
├── controllers/
│   ├── matchmaking.controller.ts
│   ├── matches.controller.ts
│   └── leaderboard.controller.ts
└── routes/
    ├── matchmaking.routes.ts
    ├── matches.routes.ts
    ├── leaderboard.routes.ts
    └── index.ts (updated)
```

### Frontend
```
store/
└── matchStore.ts
services/api/
├── matchApi.ts
├── matchmakingApi.ts
└── leaderboardApi.ts
app/
├── match/
│   └── [id].tsx
├── club/
│   └── create.tsx
└── (tabs)/
    ├── index.tsx (updated)
    └── leaderboard.tsx (updated)
```

### Database
```
Additional tables:
- matchmaking_queue
- chat_messages
- notifications
- match_moves
```

---

## 🎮 COMPLETE MVP FEATURES

With all 7 lanes complete, you now have:

| Feature | Status |
|---------|--------|
| User Registration & Login | ✅ |
| JWT Authentication | ✅ |
| Gold Economy | ✅ |
| Daily Bonus | ✅ |
| Gold Packages (Stripe-ready) | ✅ |
| Club Creation (costs gold) | ✅ |
| Club Membership | ✅ |
| Club Chip Economy | ✅ |
| Club Chat (persistent) | ✅ |
| Club Tables | ✅ |
| Matchmaking Queue | ✅ |
| Real-time Match Finding | ✅ |
| Full Backgammon Game Engine | ✅ |
| Interactive Board UI | ✅ |
| Turn-based Gameplay | ✅ |
| Gold Transfer on Win/Loss | ✅ |
| User Stats Tracking | ✅ |
| Global Leaderboard | ✅ |
| WebSocket Real-time Updates | ✅ |
| Mobile App (Expo Go) | ✅ |

**Your Backgammon Club MVP is now 100% complete!** 🎲🏆
