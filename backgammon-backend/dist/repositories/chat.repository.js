"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatRepository = exports.ChatRepository = void 0;
const connection_1 = __importDefault(require("../db/connection"));
class ChatRepository {
    async saveMessage(data) {
        const query = `
      INSERT INTO chat_messages (club_id, user_id, username, message, message_type)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
        const result = await connection_1.default.query(query, [
            data.club_id,
            data.user_id,
            data.username,
            data.message.substring(0, 1000), // Limit message length
            data.message_type || 'text',
        ]);
        return result.rows[0];
    }
    async getMessages(clubId, options = {}) {
        let query = `
      SELECT * FROM chat_messages
      WHERE club_id = $1
    `;
        const values = [clubId];
        if (options.before) {
            query += ` AND created_at < $2`;
            values.push(options.before);
        }
        query += ` ORDER BY created_at DESC LIMIT $${values.length + 1}`;
        values.push(options.limit || 50);
        const result = await connection_1.default.query(query, values);
        return result.rows.reverse(); // Return in chronological order
    }
}
exports.ChatRepository = ChatRepository;
exports.chatRepository = new ChatRepository();
