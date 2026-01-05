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

      if (!whiteUser || !blackUser) {
        throw new Error('User not found after match creation');
      }

      wsUtils.emitToUser(whitePlayer, 'match_found', {
        match_id: match.match_id,
        opponent: { user_id: blackPlayer, username: blackUser.username },
        your_color: 'white',
        stake_amount: entry1.stake_amount,
      });

      wsUtils.emitToUser(blackPlayer, 'match_found', {
        match_id: match.match_id,
        opponent: { user_id: whitePlayer, username: whiteUser.username },
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
