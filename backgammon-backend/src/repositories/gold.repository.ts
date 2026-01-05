import pool from '../db/connection';

export interface CreateGoldTransactionData {
  user_id: string;
  type: string;
  amount: number;
  balance_after: number;
  description?: string;
  payment_intent_id?: string;
  amount_usd?: number;
  related_match_id?: string;
  related_club_id?: string;
}

export class GoldRepository {
  async createTransaction(data: CreateGoldTransactionData): Promise<any> {
    const query = `
      INSERT INTO gold_transactions
      (user_id, type, amount, balance_after, description, payment_intent_id, amount_usd, related_match_id, related_club_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    const values = [
      data.user_id,
      data.type,
      data.amount,
      data.balance_after,
      data.description || null,
      data.payment_intent_id || null,
      data.amount_usd || null,
      data.related_match_id || null,
      data.related_club_id || null,
    ];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  async getTransactionsByUser(userId: string, limit: number = 50, offset: number = 0): Promise<any[]> {
    const query = `
      SELECT * FROM gold_transactions
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(query, [userId, limit, offset]);
    return result.rows;
  }
}

export const goldRepository = new GoldRepository();
