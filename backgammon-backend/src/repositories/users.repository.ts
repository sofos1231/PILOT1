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
