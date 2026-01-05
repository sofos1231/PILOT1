"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchesRepository = exports.MatchesRepository = void 0;
const connection_1 = __importDefault(require("../db/connection"));
class MatchesRepository {
    async create(data) {
        const query = `
      INSERT INTO matches (match_type, player_white_id, player_black_id, stake_amount, club_id, game_state)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
        const result = await connection_1.default.query(query, [
            data.match_type,
            data.player_white_id,
            data.player_black_id || null,
            data.stake_amount,
            data.club_id || null,
            data.game_state ? JSON.stringify(data.game_state) : null,
        ]);
        return this.parseMatch(result.rows[0]);
    }
    async findById(matchId) {
        const query = `
      SELECT m.*,
             pw.username as player_white_username,
             pb.username as player_black_username
      FROM matches m
      LEFT JOIN users pw ON m.player_white_id = pw.user_id
      LEFT JOIN users pb ON m.player_black_id = pb.user_id
      WHERE m.match_id = $1
    `;
        const result = await connection_1.default.query(query, [matchId]);
        return result.rows[0] ? this.parseMatch(result.rows[0]) : null;
    }
    async updateGameState(matchId, gameState) {
        await connection_1.default.query('UPDATE matches SET game_state = $1, last_move_at = NOW() WHERE match_id = $2', [JSON.stringify(gameState), matchId]);
    }
    async updateStatus(matchId, status) {
        const updates = { status };
        if (status === 'in_progress') {
            updates.started_at = 'NOW()';
        }
        else if (status === 'completed' || status === 'abandoned') {
            updates.completed_at = 'NOW()';
        }
        const setClause = Object.keys(updates)
            .map((key, i) => `${key} = ${updates[key] === 'NOW()' ? 'NOW()' : `$${i + 2}`}`)
            .join(', ');
        const values = Object.values(updates).filter(v => v !== 'NOW()');
        await connection_1.default.query(`UPDATE matches SET ${setClause} WHERE match_id = $1`, [matchId, ...values]);
    }
    async setWinner(matchId, winnerId, finalCubeValue = 1) {
        await connection_1.default.query(`UPDATE matches
       SET winner_id = $1, final_cube_value = $2, status = 'completed', completed_at = NOW()
       WHERE match_id = $3`, [winnerId, finalCubeValue, matchId]);
    }
    async setPlayerReady(matchId, playerId, isWhite) {
        const column = isWhite ? 'player_white_ready' : 'player_black_ready';
        await connection_1.default.query(`UPDATE matches SET ${column} = TRUE WHERE match_id = $1`, [matchId]);
    }
    async getUserMatches(userId, status, limit = 20) {
        let query = `
      SELECT m.*,
             pw.username as player_white_username,
             pb.username as player_black_username
      FROM matches m
      LEFT JOIN users pw ON m.player_white_id = pw.user_id
      LEFT JOIN users pb ON m.player_black_id = pb.user_id
      WHERE (m.player_white_id = $1 OR m.player_black_id = $1)
    `;
        const values = [userId];
        if (status) {
            query += ` AND m.status = $2`;
            values.push(status);
        }
        query += ` ORDER BY m.created_at DESC LIMIT $${values.length + 1}`;
        values.push(limit);
        const result = await connection_1.default.query(query, values);
        return result.rows.map(row => this.parseMatch(row));
    }
    async recordMove(matchId, playerId, moveNumber, diceValues, moves, gameStateAfter) {
        await connection_1.default.query(`INSERT INTO match_moves (match_id, player_id, move_number, dice_values, moves, game_state_after)
       VALUES ($1, $2, $3, $4, $5, $6)`, [matchId, playerId, moveNumber, diceValues, JSON.stringify(moves), JSON.stringify(gameStateAfter)]);
    }
    parseMatch(row) {
        return {
            ...row,
            game_state: row.game_state ? (typeof row.game_state === 'string' ? JSON.parse(row.game_state) : row.game_state) : null,
        };
    }
}
exports.MatchesRepository = MatchesRepository;
exports.matchesRepository = new MatchesRepository();
