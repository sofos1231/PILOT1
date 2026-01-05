"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.leaderboardService = exports.LeaderboardService = void 0;
const connection_1 = __importDefault(require("../db/connection"));
class LeaderboardService {
    /**
     * Get global leaderboard by wins
     */
    async getGlobalLeaderboard(options = {}) {
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
            connection_1.default.query(query, [limit, offset]),
            connection_1.default.query(countQuery),
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
    async getUserRank(userId, sortBy = 'wins') {
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
        const result = await connection_1.default.query(query, [userId]);
        return result.rows[0] ? parseInt(result.rows[0].rank) : null;
    }
    /**
     * Get leaderboard around a user
     */
    async getLeaderboardAroundUser(userId, range = 5) {
        const userRank = await this.getUserRank(userId);
        if (!userRank)
            return [];
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
exports.LeaderboardService = LeaderboardService;
exports.leaderboardService = new LeaderboardService();
