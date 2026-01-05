"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.usersRepository = exports.UsersRepository = void 0;
const connection_1 = __importDefault(require("../db/connection"));
class UsersRepository {
    async create(data) {
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
        const result = await connection_1.default.query(query, values);
        return result.rows[0];
    }
    async findByEmail(email) {
        const query = 'SELECT * FROM users WHERE LOWER(email) = LOWER($1)';
        const result = await connection_1.default.query(query, [email.trim()]);
        return result.rows[0] || null;
    }
    async findByUsername(username) {
        const query = 'SELECT * FROM users WHERE LOWER(username) = LOWER($1)';
        const result = await connection_1.default.query(query, [username.trim()]);
        return result.rows[0] || null;
    }
    async findById(userId) {
        const query = 'SELECT * FROM users WHERE user_id = $1';
        const result = await connection_1.default.query(query, [userId]);
        return result.rows[0] || null;
    }
    async updateLastLogin(userId) {
        const query = 'UPDATE users SET last_login = NOW() WHERE user_id = $1';
        await connection_1.default.query(query, [userId]);
    }
    async updateGoldBalance(userId, newBalance) {
        const query = 'UPDATE users SET gold_balance = $1 WHERE user_id = $2';
        await connection_1.default.query(query, [newBalance, userId]);
    }
    async storeRefreshToken(userId, tokenHash, expiresAt) {
        const query = `
      INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
      VALUES ($1, $2, $3)
    `;
        await connection_1.default.query(query, [userId, tokenHash, expiresAt]);
    }
    async getRefreshTokens(userId) {
        const query = `
      SELECT * FROM refresh_tokens
      WHERE user_id = $1 AND revoked = FALSE AND expires_at > NOW()
    `;
        const result = await connection_1.default.query(query, [userId]);
        return result.rows;
    }
    async revokeAllRefreshTokens(userId) {
        const query = 'UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1';
        await connection_1.default.query(query, [userId]);
    }
}
exports.UsersRepository = UsersRepository;
exports.usersRepository = new UsersRepository();
