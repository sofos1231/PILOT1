"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.goldRepository = exports.GoldRepository = void 0;
const connection_1 = __importDefault(require("../db/connection"));
class GoldRepository {
    async createTransaction(data) {
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
        const result = await connection_1.default.query(query, values);
        return result.rows[0];
    }
    async getTransactionsByUser(userId, limit = 50, offset = 0) {
        const query = `
      SELECT * FROM gold_transactions
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;
        const result = await connection_1.default.query(query, [userId, limit, offset]);
        return result.rows;
    }
}
exports.GoldRepository = GoldRepository;
exports.goldRepository = new GoldRepository();
