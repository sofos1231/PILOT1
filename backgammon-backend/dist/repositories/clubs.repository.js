"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clubsRepository = exports.ClubsRepository = void 0;
const connection_1 = __importDefault(require("../db/connection"));
class ClubsRepository {
    // ===== CLUBS =====
    async create(data) {
        const query = `
      INSERT INTO clubs (name, description, logo_url, owner_id, privacy, welcome_bonus)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
        const values = [
            data.name.trim(),
            data.description?.trim() || null,
            data.logo_url || null,
            data.owner_id,
            data.privacy || 'public',
            data.welcome_bonus || 0,
        ];
        const result = await connection_1.default.query(query, values);
        return result.rows[0];
    }
    async findById(clubId) {
        const query = 'SELECT * FROM clubs WHERE club_id = $1 AND is_active = TRUE';
        const result = await connection_1.default.query(query, [clubId]);
        return result.rows[0] || null;
    }
    async findByName(name) {
        const query = 'SELECT * FROM clubs WHERE LOWER(name) = LOWER($1) AND is_active = TRUE';
        const result = await connection_1.default.query(query, [name.trim()]);
        return result.rows[0] || null;
    }
    async search(options) {
        let query = 'SELECT * FROM clubs WHERE is_active = TRUE';
        let countQuery = 'SELECT COUNT(*) FROM clubs WHERE is_active = TRUE';
        const values = [];
        let paramIndex = 1;
        if (options.search) {
            query += ` AND (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
            countQuery += ` AND (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
            values.push(`%${options.search}%`);
            paramIndex++;
        }
        if (options.privacy && options.privacy !== 'all') {
            query += ` AND privacy = $${paramIndex}`;
            countQuery += ` AND privacy = $${paramIndex}`;
            values.push(options.privacy);
            paramIndex++;
        }
        const countValues = [...values];
        query += ` ORDER BY member_count DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        values.push(options.limit || 20, options.offset || 0);
        const [clubsResult, countResult] = await Promise.all([
            connection_1.default.query(query, values),
            connection_1.default.query(countQuery, countValues),
        ]);
        return {
            clubs: clubsResult.rows,
            total: parseInt(countResult.rows[0].count),
        };
    }
    async update(clubId, data) {
        const updates = [];
        const values = [];
        let paramIndex = 1;
        if (data.name !== undefined) {
            updates.push(`name = $${paramIndex++}`);
            values.push(data.name.trim());
        }
        if (data.description !== undefined) {
            updates.push(`description = $${paramIndex++}`);
            values.push(data.description?.trim() || null);
        }
        if (data.logo_url !== undefined) {
            updates.push(`logo_url = $${paramIndex++}`);
            values.push(data.logo_url);
        }
        if (data.privacy !== undefined) {
            updates.push(`privacy = $${paramIndex++}`);
            values.push(data.privacy);
        }
        if (data.welcome_bonus !== undefined) {
            updates.push(`welcome_bonus = $${paramIndex++}`);
            values.push(data.welcome_bonus);
        }
        if (updates.length === 0) {
            const club = await this.findById(clubId);
            if (!club)
                throw new Error('Club not found');
            return club;
        }
        values.push(clubId);
        const query = `
      UPDATE clubs SET ${updates.join(', ')}, updated_at = NOW()
      WHERE club_id = $${paramIndex}
      RETURNING *
    `;
        const result = await connection_1.default.query(query, values);
        return result.rows[0];
    }
    async incrementMemberCount(clubId) {
        await connection_1.default.query('UPDATE clubs SET member_count = member_count + 1 WHERE club_id = $1', [clubId]);
    }
    async decrementMemberCount(clubId) {
        await connection_1.default.query('UPDATE clubs SET member_count = GREATEST(member_count - 1, 0) WHERE club_id = $1', [clubId]);
    }
    // ===== MEMBERSHIPS =====
    async createMembership(data) {
        const query = `
      INSERT INTO club_memberships (club_id, user_id, role, chip_balance)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
        const result = await connection_1.default.query(query, [
            data.club_id,
            data.user_id,
            data.role,
            data.chip_balance || 0,
        ]);
        return result.rows[0];
    }
    async getMembership(clubId, userId) {
        const query = `
      SELECT cm.*, u.username, u.avatar_url, u.level
      FROM club_memberships cm
      JOIN users u ON cm.user_id = u.user_id
      WHERE cm.club_id = $1 AND cm.user_id = $2
    `;
        const result = await connection_1.default.query(query, [clubId, userId]);
        return result.rows[0] || null;
    }
    async getMembers(clubId, options) {
        let query = `
      SELECT cm.*, u.username, u.avatar_url, u.level
      FROM club_memberships cm
      JOIN users u ON cm.user_id = u.user_id
      WHERE cm.club_id = $1
    `;
        let countQuery = `
      SELECT COUNT(*) FROM club_memberships WHERE club_id = $1
    `;
        const values = [clubId];
        let paramIndex = 2;
        if (options?.search) {
            query += ` AND u.username ILIKE $${paramIndex}`;
            values.push(`%${options.search}%`);
            paramIndex++;
        }
        // Sort order
        const sortColumn = {
            chips: 'cm.chip_balance DESC',
            name: 'u.username ASC',
            joined: 'cm.joined_at DESC',
        }[options?.sort || 'chips'] || 'cm.chip_balance DESC';
        query += ` ORDER BY cm.role = 'owner' DESC, cm.role = 'admin' DESC, ${sortColumn}`;
        query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        values.push(options?.limit || 50, options?.offset || 0);
        const [membersResult, countResult] = await Promise.all([
            connection_1.default.query(query, values),
            connection_1.default.query(countQuery, [clubId]),
        ]);
        return {
            members: membersResult.rows,
            total: parseInt(countResult.rows[0].count),
        };
    }
    async getUserClubs(userId) {
        const query = `
      SELECT c.*, cm.chip_balance, cm.role
      FROM clubs c
      JOIN club_memberships cm ON c.club_id = cm.club_id
      WHERE cm.user_id = $1 AND c.is_active = TRUE
      ORDER BY cm.joined_at DESC
    `;
        const result = await connection_1.default.query(query, [userId]);
        return result.rows;
    }
    async updateMemberChips(clubId, userId, amount) {
        const query = `
      UPDATE club_memberships
      SET chip_balance = GREATEST(chip_balance + $1, 0)
      WHERE club_id = $2 AND user_id = $3
      RETURNING chip_balance
    `;
        const result = await connection_1.default.query(query, [amount, clubId, userId]);
        return result.rows[0]?.chip_balance || 0;
    }
    async setMemberChips(clubId, userId, balance) {
        await connection_1.default.query('UPDATE club_memberships SET chip_balance = $1 WHERE club_id = $2 AND user_id = $3', [Math.max(0, balance), clubId, userId]);
    }
    async updateMemberRole(clubId, userId, role) {
        await connection_1.default.query('UPDATE club_memberships SET role = $1 WHERE club_id = $2 AND user_id = $3', [role, clubId, userId]);
    }
    async removeMember(clubId, userId) {
        await connection_1.default.query('DELETE FROM club_memberships WHERE club_id = $1 AND user_id = $2', [clubId, userId]);
    }
    // ===== JOIN REQUESTS =====
    async createJoinRequest(clubId, userId) {
        const query = `
      INSERT INTO club_join_requests (club_id, user_id, status)
      VALUES ($1, $2, 'pending')
      ON CONFLICT (club_id, user_id) DO UPDATE SET status = 'pending', created_at = NOW()
      RETURNING *
    `;
        const result = await connection_1.default.query(query, [clubId, userId]);
        return result.rows[0];
    }
    async getJoinRequest(clubId, userId) {
        const query = 'SELECT * FROM club_join_requests WHERE club_id = $1 AND user_id = $2';
        const result = await connection_1.default.query(query, [clubId, userId]);
        return result.rows[0] || null;
    }
    async getPendingRequests(clubId) {
        const query = `
      SELECT jr.*, u.username, u.avatar_url
      FROM club_join_requests jr
      JOIN users u ON jr.user_id = u.user_id
      WHERE jr.club_id = $1 AND jr.status = 'pending'
      ORDER BY jr.created_at ASC
    `;
        const result = await connection_1.default.query(query, [clubId]);
        return result.rows;
    }
    async updateJoinRequestStatus(requestId, status) {
        await connection_1.default.query('UPDATE club_join_requests SET status = $1 WHERE request_id = $2', [status, requestId]);
    }
    // ===== CHIP TRANSACTIONS =====
    async createChipTransaction(data) {
        const query = `
      INSERT INTO club_chip_transactions
      (club_id, type, from_user_id, to_user_id, amount, balance_after, reason)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;
        await connection_1.default.query(query, [
            data.club_id,
            data.type,
            data.from_user_id || null,
            data.to_user_id,
            data.amount,
            data.balance_after,
            data.reason || null,
        ]);
    }
    async getChipTransactions(clubId, userId, limit = 50) {
        const query = `
      SELECT * FROM club_chip_transactions
      WHERE club_id = $1 AND (from_user_id = $2 OR to_user_id = $2)
      ORDER BY created_at DESC
      LIMIT $3
    `;
        const result = await connection_1.default.query(query, [clubId, userId, limit]);
        return result.rows;
    }
    // ===== TABLES =====
    async createTable(data) {
        const query = `
      INSERT INTO club_tables (club_id, creator_user_id, stake_amount, privacy)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
        const result = await connection_1.default.query(query, [
            data.club_id,
            data.creator_user_id,
            data.stake_amount,
            data.privacy || 'public',
        ]);
        return result.rows[0];
    }
    async getTables(clubId) {
        const query = `
      SELECT ct.*, u.username as creator_username
      FROM club_tables ct
      JOIN users u ON ct.creator_user_id = u.user_id
      WHERE ct.club_id = $1 AND ct.status IN ('waiting', 'started')
      ORDER BY ct.created_at DESC
    `;
        const result = await connection_1.default.query(query, [clubId]);
        return result.rows;
    }
    async getTable(tableId) {
        const query = `
      SELECT ct.*, u.username as creator_username
      FROM club_tables ct
      JOIN users u ON ct.creator_user_id = u.user_id
      WHERE ct.table_id = $1
    `;
        const result = await connection_1.default.query(query, [tableId]);
        return result.rows[0] || null;
    }
    async updateTableStatus(tableId, status, matchId) {
        await connection_1.default.query('UPDATE club_tables SET status = $1, match_id = $2 WHERE table_id = $3', [status, matchId || null, tableId]);
    }
    async cancelTable(tableId) {
        await connection_1.default.query("UPDATE club_tables SET status = 'cancelled' WHERE table_id = $1", [tableId]);
    }
}
exports.ClubsRepository = ClubsRepository;
exports.clubsRepository = new ClubsRepository();
