import pool from '../db/connection';
import { matchmakingRepository } from '../repositories/matchmaking.repository';
import { matchesRepository } from '../repositories/matches.repository';
import { usersRepository } from '../repositories/users.repository';
import { gameEngineService } from './game-engine.service';
import { wsUtils } from '../websocket';
import { MatchmakingResult, QueueEntry } from '../types/matchmaking.types';
import { ValidationError, NotFoundError } from '../errors/AppError';

// Track if queue processor is running
let queueProcessorInterval: NodeJS.Timeout | null = null;

export class MatchmakingService {
  async joinQueue(
    userId: string,
    stakeAmount: number,
    matchType: 'gold' | 'club' = 'gold',
    clubId?: string
  ): Promise<MatchmakingResult> {
    const user = await usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User');
    }

    if (matchType === 'gold' && user.gold_balance < stakeAmount) {
      throw new ValidationError(`Insufficient gold. You have ${user.gold_balance}, need ${stakeAmount}`);
    }

    if (matchType === 'club' && clubId) {
      const membership = await pool.query(
        'SELECT chip_balance FROM club_memberships WHERE club_id = $1 AND user_id = $2',
        [clubId, userId]
      );
      if (!membership.rows[0] || membership.rows[0].chip_balance < stakeAmount) {
        throw new ValidationError('Insufficient chips for this stake');
      }
    }

    const queueEntry = await matchmakingRepository.addToQueue({
      user_id: userId,
      stake_amount: stakeAmount,
      match_type: matchType,
      club_id: clubId,
    });

    const opponent = await matchmakingRepository.findMatch(queueEntry);

    if (opponent) {
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

    const position = await matchmakingRepository.getQueuePosition(queueEntry);

    return {
      matched: false,
      queue_position: position,
      estimated_wait: position * 15,
    };
  }

  private async createMatchFromQueue(entry1: QueueEntry, entry2: QueueEntry): Promise<any> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const whitePlayer = Math.random() < 0.5 ? entry1.user_id : entry2.user_id;
      const blackPlayer = whitePlayer === entry1.user_id ? entry2.user_id : entry1.user_id;

      const initialState = gameEngineService.initializeGame();

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

      await client.query(
        "UPDATE matchmaking_queue SET status = 'matched', matched_with_user_id = $1, match_id = $2 WHERE queue_id = $3",
        [entry2.user_id, match.match_id, entry1.queue_id]
      );
      await client.query(
        "UPDATE matchmaking_queue SET status = 'matched', matched_with_user_id = $1, match_id = $2 WHERE queue_id = $3",
        [entry1.user_id, match.match_id, entry2.queue_id]
      );

      await client.query('COMMIT');

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

  async leaveQueue(userId: string): Promise<boolean> {
    const cancelled = await matchmakingRepository.cancelQueue(userId);
    return cancelled;
  }

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

  async processQueue(): Promise<number> {
    await matchmakingRepository.cleanExpiredEntries();

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

export function startQueueProcessor(): void {
  if (queueProcessorInterval) {
    console.log('Queue processor already running');
    return;
  }

  console.log('Starting matchmaking queue processor...');
  queueProcessorInterval = setInterval(async () => {
    try {
      await matchmakingService.processQueue();
    } catch (error: any) {
      const msg = error?.message || '';
      if (msg.includes('ECONNREFUSED') || msg.includes('Connection terminated') || msg.includes('connect')) {
        return;
      }
      console.error('Queue processor error:', msg);
    }
  }, 5000);
}

export function stopQueueProcessor(): void {
  if (queueProcessorInterval) {
    clearInterval(queueProcessorInterval);
    queueProcessorInterval = null;
    console.log('Queue processor stopped');
  }
}