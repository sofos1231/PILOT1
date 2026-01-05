"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchmakingService = exports.MatchmakingService = void 0;
const connection_1 = __importDefault(require("../db/connection"));
const matchmaking_repository_1 = require("../repositories/matchmaking.repository");
const users_repository_1 = require("../repositories/users.repository");
const game_engine_service_1 = require("./game-engine.service");
const websocket_1 = require("../websocket");
const AppError_1 = require("../errors/AppError");
class MatchmakingService {
    /**
     * Join matchmaking queue
     */
    async joinQueue(userId, stakeAmount, matchType = 'gold', clubId) {
        // Validate user has enough gold/chips
        const user = await users_repository_1.usersRepository.findById(userId);
        if (!user) {
            throw new AppError_1.NotFoundError('User');
        }
        if (matchType === 'gold' && user.gold_balance < stakeAmount) {
            throw new AppError_1.ValidationError(`Insufficient gold. You have ${user.gold_balance}, need ${stakeAmount}`);
        }
        // For club matches, validate chip balance
        if (matchType === 'club' && clubId) {
            const membership = await connection_1.default.query('SELECT chip_balance FROM club_memberships WHERE club_id = $1 AND user_id = $2', [clubId, userId]);
            if (!membership.rows[0] || membership.rows[0].chip_balance < stakeAmount) {
                throw new AppError_1.ValidationError('Insufficient chips for this stake');
            }
        }
        // Add to queue
        const queueEntry = await matchmaking_repository_1.matchmakingRepository.addToQueue({
            user_id: userId,
            stake_amount: stakeAmount,
            match_type: matchType,
            club_id: clubId,
        });
        // Try to find immediate match
        const opponent = await matchmaking_repository_1.matchmakingRepository.findMatch(queueEntry);
        if (opponent) {
            // Match found! Create the match
            const match = await this.createMatchFromQueue(queueEntry, opponent);
            return {
                matched: true,
                match_id: match.match_id,
                opponent: {
                    user_id: opponent.user_id,
                    username: opponent.username,
                    level: opponent.level,
                    wins: opponent.wins,
                },
            };
        }
        // No immediate match, return queue position
        const position = await matchmaking_repository_1.matchmakingRepository.getQueuePosition(queueEntry);
        return {
            matched: false,
            queue_position: position,
            estimated_wait: position * 15, // Rough estimate: 15 seconds per position
        };
    }
    /**
     * Create match from two queue entries
     */
    async createMatchFromQueue(entry1, entry2) {
        const client = await connection_1.default.connect();
        try {
            await client.query('BEGIN');
            // Randomly assign colors
            const whitePlayer = Math.random() < 0.5 ? entry1.user_id : entry2.user_id;
            const blackPlayer = whitePlayer === entry1.user_id ? entry2.user_id : entry1.user_id;
            // Initialize game state
            const initialState = game_engine_service_1.gameEngineService.initializeGame();
            // Create match
            const matchResult = await client.query(`INSERT INTO matches
         (match_type, status, player_white_id, player_black_id, stake_amount, club_id, game_state)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`, [
                entry1.match_type,
                'ready',
                whitePlayer,
                blackPlayer,
                entry1.stake_amount,
                entry1.club_id,
                JSON.stringify(initialState),
            ]);
            const match = matchResult.rows[0];
            // Update both queue entries
            await client.query("UPDATE matchmaking_queue SET status = 'matched', matched_with_user_id = $1, match_id = $2 WHERE queue_id = $3", [entry2.user_id, match.match_id, entry1.queue_id]);
            await client.query("UPDATE matchmaking_queue SET status = 'matched', matched_with_user_id = $1, match_id = $2 WHERE queue_id = $3", [entry1.user_id, match.match_id, entry2.queue_id]);
            await client.query('COMMIT');
            // Notify both players via WebSocket
            const whiteUser = await users_repository_1.usersRepository.findById(whitePlayer);
            const blackUser = await users_repository_1.usersRepository.findById(blackPlayer);
            if (!whiteUser || !blackUser) {
                throw new Error('User not found after match creation');
            }
            websocket_1.wsUtils.emitToUser(whitePlayer, 'match_found', {
                match_id: match.match_id,
                opponent: { user_id: blackPlayer, username: blackUser.username },
                your_color: 'white',
                stake_amount: entry1.stake_amount,
            });
            websocket_1.wsUtils.emitToUser(blackPlayer, 'match_found', {
                match_id: match.match_id,
                opponent: { user_id: whitePlayer, username: whiteUser.username },
                your_color: 'black',
                stake_amount: entry1.stake_amount,
            });
            return match;
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    /**
     * Leave matchmaking queue
     */
    async leaveQueue(userId) {
        const cancelled = await matchmaking_repository_1.matchmakingRepository.cancelQueue(userId);
        return cancelled;
    }
    /**
     * Get current queue status
     */
    async getQueueStatus(userId) {
        const entry = await matchmaking_repository_1.matchmakingRepository.getQueueEntry(userId);
        if (!entry) {
            return { in_queue: false };
        }
        const position = await matchmaking_repository_1.matchmakingRepository.getQueuePosition(entry);
        return {
            in_queue: true,
            position,
            stake_amount: entry.stake_amount,
        };
    }
    /**
     * Background job: Try to match queued players
     */
    async processQueue() {
        // Clean expired entries first
        await matchmaking_repository_1.matchmakingRepository.cleanExpiredEntries();
        // Get all waiting entries
        const result = await connection_1.default.query("SELECT * FROM matchmaking_queue WHERE status = 'waiting' AND expires_at > NOW() ORDER BY created_at ASC");
        let matchesCreated = 0;
        const processedIds = new Set();
        for (const entry of result.rows) {
            if (processedIds.has(entry.queue_id))
                continue;
            const opponent = await matchmaking_repository_1.matchmakingRepository.findMatch(entry);
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
exports.MatchmakingService = MatchmakingService;
exports.matchmakingService = new MatchmakingService();
// Start background queue processor (runs every 5 seconds)
setInterval(async () => {
    try {
        await exports.matchmakingService.processQueue();
    }
    catch (error) {
        console.error('Queue processor error:', error);
    }
}, 5000);
