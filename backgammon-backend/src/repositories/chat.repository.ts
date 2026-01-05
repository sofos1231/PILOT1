import pool from '../db/connection';

export interface ChatMessage {
  message_id: string;
  club_id: string;
  user_id: string | null;
  username: string;
  message: string;
  message_type: 'text' | 'system' | 'emote';
  created_at: Date;
}

export class ChatRepository {
  async saveMessage(data: {
    club_id: string;
    user_id: string;
    username: string;
    message: string;
    message_type?: 'text' | 'system' | 'emote';
  }): Promise<ChatMessage> {
    const query = `
      INSERT INTO chat_messages (club_id, user_id, username, message, message_type)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const result = await pool.query(query, [
      data.club_id,
      data.user_id,
      data.username,
      data.message.substring(0, 1000), // Limit message length
      data.message_type || 'text',
    ]);
    return result.rows[0];
  }

  async getMessages(clubId: string, options: {
    limit?: number;
    before?: Date;
  } = {}): Promise<ChatMessage[]> {
    let query = `
      SELECT * FROM chat_messages
      WHERE club_id = $1
    `;
    const values: any[] = [clubId];

    if (options.before) {
      query += ` AND created_at < $2`;
      values.push(options.before);
    }

    query += ` ORDER BY created_at DESC LIMIT $${values.length + 1}`;
    values.push(options.limit || 50);

    const result = await pool.query(query, values);
    return result.rows.reverse(); // Return in chronological order
  }
}

export const chatRepository = new ChatRepository();
