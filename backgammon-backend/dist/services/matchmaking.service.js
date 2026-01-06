"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchmakingService = exports.MatchmakingService = void 0;
exports.startQueueProcessor = startQueueProcessor;
exports.stopQueueProcessor = stopQueueProcessor;
const connection_1 = __importDefault(require("../db/connection"));
const matchmaking_repository_1 = require("../repositories/matchmaking.repository");
const users_repository_1 = require("../repositories/users.repository");
const game_engine_service_1 = require("./game-engine.service");
const websocket_1 = require("../websocket");
const AppError_1 = require("../errors/AppError");
// Track if queue processor is running
let queueProcessorInterval = null;
class MatchmakingService {
    async joinQueue(userId, stakeAmount, matchType = 'gold', clubId) {
        const user = await users_repository_1.usersRepository.findById(userId);
        if (!user) {
            throw new AppError_1.NotFoundError('User');
        }
        if (matchType === 'gold' && user.gold_balance < stakeAmount) {
            throw new AppError_1.ValidationError(`Insufficient gold. You have ${user.gold_balance}, need ${stakeAmount}`);
        }
        if (matchType === 'club' && clubId) {
            const membership = await connection_1.default.query('SELECT chip_balance FROM club_memberships WHERE club_id = $1 AND user_id = $2', [clubId, userId]);
            if (!membership.rows[0] || membership.rows[0].chip_balance < stakeAmount) {
                throw new AppError_1.ValidationError('Insufficient chips for this stake');
            }
        }
        const queueEntry = await matchmaking_repository_1.matchmakingRepository.addToQueue({
            user_id: userId,
            stake_amount: stakeAmount,
            match_type: matchType,
            club_id: clubId,
        });
        const opponent = await matchmaking_repository_1.matchmakingRepository.findMatch(queueEntry);
        if (opponent) {
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
        const position = await matchmaking_repository_1.matchmakingRepository.getQueuePosition(queueEntry);
        return {
            matched: false,
            queue_position: position,
            estimated_wait: position * 15,
        };
    }
    async createMatchFromQueue(entry1, entry2) {
        const client = await connection_1.default.connect();
        try {
            await client.query('BEGIN');
            const whitePlayer = Math.random() < 0.5 ? entry1.user_id : entry2.user_id;
            const blackPlayer = whitePlayer === entry1.user_id ? entry2.user_id : entry1.user_id;
            const initialState = game_engine_service_1.gameEngineService.initializeGame();
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
            await client.query("UPDATE matchmaking_queue SET status = 'matched', matched_with_user_id = $1, match_id = $2 WHERE queue_id = $3", [entry2.user_id, match.match_id, entry1.queue_id]);
            await client.query("UPDATE matchmaking_queue SET status = 'matched', matched_with_user_id = $1, match_id = $2 WHERE queue_id = $3", [entry1.user_id, match.match_id, entry2.queue_id]);
            await client.query('COMMIT');
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
    async leaveQueue(userId) {
        const cancelled = await matchmaking_repository_1.matchmakingRepository.cancelQueue(userId);
        return cancelled;
    }
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
    async processQueue() {
        await matchmaking_repository_1.matchmakingRepository.cleanExpiredEntries();
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
function startQueueProcessor() {
    if (queueProcessorInterval) {
        console.log('Queue processor already running');
        return;
    }
    console.log('Starting matchmaking queue processor...');
    queueProcessorInterval = setInterval(async () => {
        try {
            await exports.matchmakingService.processQueue();
        }
        catch (error) {
            const msg = error?.message || '';
            if (msg.includes('ECONNREFUSED') || msg.includes('Connection terminated') || msg.includes('connect')) {
                return;
            }
            console.error('Queue processor error:', msg);
        }
    }, 5000);
}
function stopQueueProcessor() {
    if (queueProcessorInterval) {
        clearInterval(queueProcessorInterval);
        queueProcessorInterval = null;
        console.log('Queue processor stopped');
    }
}
