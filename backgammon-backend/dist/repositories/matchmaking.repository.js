"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchmakingRepository = exports.MatchmakingRepository = void 0;
const connection_1 = __importDefault(require("../db/connection"));
class MatchmakingRepository {
    async addToQueue(data) {
        // First, cancel any existing queue entries for this user
        await connection_1.default.query("UPDATE matchmaking_queue SET status = 'cancelled' WHERE user_id = $1 AND status = 'waiting'", [data.user_id]);
        const query = `
      INSERT INTO matchmaking_queue (user_id, stake_amount, match_type, club_id)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
        const result = await connection_1.default.query(query, [
            data.user_id,
            data.stake_amount,
            data.match_type || 'gold',
            data.club_id || null,
        ]);
        return result.rows[0];
    }
    async findMatch(queueEntry) {
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
        const result = await connection_1.default.query(query, values);
        return result.rows[0] || null;
    }
    async getQueueEntry(userId) {
        const query = `
      SELECT * FROM matchmaking_queue
      WHERE user_id = $1 AND status = 'waiting'
      ORDER BY created_at DESC
      LIMIT 1
    `;
        const result = await connection_1.default.query(query, [userId]);
        return result.rows[0] || null;
    }
    async updateQueueStatus(queueId, status, matchedWith, matchId) {
        await connection_1.default.query(`UPDATE matchmaking_queue
       SET status = $1, matched_with_user_id = $2, match_id = $3
       WHERE queue_id = $4`, [status, matchedWith || null, matchId || null, queueId]);
    }
    async cancelQueue(userId) {
        const result = await connection_1.default.query("UPDATE matchmaking_queue SET status = 'cancelled' WHERE user_id = $1 AND status = 'waiting' RETURNING *", [userId]);
        return (result.rowCount ?? 0) > 0;
    }
    async getQueuePosition(queueEntry) {
        const query = `
      SELECT COUNT(*) as position
      FROM matchmaking_queue
      WHERE status = 'waiting'
        AND stake_amount = $1
        AND match_type = $2
        AND created_at < $3
    `;
        const result = await connection_1.default.query(query, [
            queueEntry.stake_amount,
            queueEntry.match_type,
            queueEntry.created_at,
        ]);
        return parseInt(result.rows[0].position) + 1;
    }
    async cleanExpiredEntries() {
        const result = await connection_1.default.query("UPDATE matchmaking_queue SET status = 'expired' WHERE status = 'waiting' AND expires_at < NOW() RETURNING *");
        return result.rowCount ?? 0;
    }
}
exports.MatchmakingRepository = MatchmakingRepository;
exports.matchmakingRepository = new MatchmakingRepository();
