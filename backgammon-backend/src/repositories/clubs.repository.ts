import pool from '../db/connection';
import { Club, ClubMembership, CreateClubData, ClubTable, ClubJoinRequest } from '../types/club.types';

export class ClubsRepository {
  // ===== CLUBS =====

  async create(data: CreateClubData & { owner_id: string }): Promise<Club> {
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
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  async findById(clubId: string): Promise<Club | null> {
    const query = 'SELECT * FROM clubs WHERE club_id = $1 AND is_active = TRUE';
    const result = await pool.query(query, [clubId]);
    return result.rows[0] || null;
  }

  async findByName(name: string): Promise<Club | null> {
    const query = 'SELECT * FROM clubs WHERE LOWER(name) = LOWER($1) AND is_active = TRUE';
    const result = await pool.query(query, [name.trim()]);
    return result.rows[0] || null;
  }

  async search(options: {
    search?: string;
    privacy?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ clubs: Club[]; total: number }> {
    let query = 'SELECT * FROM clubs WHERE is_active = TRUE';
    let countQuery = 'SELECT COUNT(*) FROM clubs WHERE is_active = TRUE';
    const values: any[] = [];
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
      pool.query(query, values),
      pool.query(countQuery, countValues),
    ]);

    return {
      clubs: clubsResult.rows,
      total: parseInt(countResult.rows[0].count),
    };
  }

  async update(clubId: string, data: Partial<CreateClubData>): Promise<Club> {
    const updates: string[] = [];
    const values: any[] = [];
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
      if (!club) throw new Error('Club not found');
      return club;
    }

    values.push(clubId);

    const query = `
      UPDATE clubs SET ${updates.join(', ')}, updated_at = NOW()
      WHERE club_id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  async incrementMemberCount(clubId: string): Promise<void> {
    await pool.query(
      'UPDATE clubs SET member_count = member_count + 1 WHERE club_id = $1',
      [clubId]
    );
  }

  async decrementMemberCount(clubId: string): Promise<void> {
    await pool.query(
      'UPDATE clubs SET member_count = GREATEST(member_count - 1, 0) WHERE club_id = $1',
      [clubId]
    );
  }

  // ===== MEMBERSHIPS =====

  async createMembership(data: {
    club_id: string;
    user_id: string;
    role: 'owner' | 'admin' | 'member';
    chip_balance?: number;
  }): Promise<ClubMembership> {
    const query = `
      INSERT INTO club_memberships (club_id, user_id, role, chip_balance)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const result = await pool.query(query, [
      data.club_id,
      data.user_id,
      data.role,
      data.chip_balance || 0,
    ]);
    return result.rows[0];
  }

  async getMembership(clubId: string, userId: string): Promise<ClubMembership | null> {
    const query = `
      SELECT cm.*, u.username, u.avatar_url, u.level
      FROM club_memberships cm
      JOIN users u ON cm.user_id = u.user_id
      WHERE cm.club_id = $1 AND cm.user_id = $2
    `;
    const result = await pool.query(query, [clubId, userId]);
    return result.rows[0] || null;
  }

  async getMembers(clubId: string, options?: {
    search?: string;
    sort?: 'chips' | 'name' | 'joined';
    limit?: number;
    offset?: number;
  }): Promise<{ members: ClubMembership[]; total: number }> {
    let query = `
      SELECT cm.*, u.username, u.avatar_url, u.level
      FROM club_memberships cm
      JOIN users u ON cm.user_id = u.user_id
      WHERE cm.club_id = $1
    `;
    let countQuery = `
      SELECT COUNT(*) FROM club_memberships WHERE club_id = $1
    `;
    const values: any[] = [clubId];
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
      pool.query(query, values),
      pool.query(countQuery, [clubId]),
    ]);

    return {
      members: membersResult.rows,
      total: parseInt(countResult.rows[0].count),
    };
  }

  async getUserClubs(userId: string): Promise<(Club & { chip_balance: number; role: string })[]> {
    const query = `
      SELECT c.*, cm.chip_balance, cm.role
      FROM clubs c
      JOIN club_memberships cm ON c.club_id = cm.club_id
      WHERE cm.user_id = $1 AND c.is_active = TRUE
      ORDER BY cm.joined_at DESC
    `;
    const result = await pool.query(query, [userId]);
    return result.rows;
  }

  async updateMemberChips(clubId: string, userId: string, amount: number): Promise<number> {
    const query = `
      UPDATE club_memberships
      SET chip_balance = GREATEST(chip_balance + $1, 0)
      WHERE club_id = $2 AND user_id = $3
      RETURNING chip_balance
    `;
    const result = await pool.query(query, [amount, clubId, userId]);
    return result.rows[0]?.chip_balance || 0;
  }

  async setMemberChips(clubId: string, userId: string, balance: number): Promise<void> {
    await pool.query(
      'UPDATE club_memberships SET chip_balance = $1 WHERE club_id = $2 AND user_id = $3',
      [Math.max(0, balance), clubId, userId]
    );
  }

  async updateMemberRole(clubId: string, userId: string, role: 'owner' | 'admin' | 'member'): Promise<void> {
    await pool.query(
      'UPDATE club_memberships SET role = $1 WHERE club_id = $2 AND user_id = $3',
      [role, clubId, userId]
    );
  }

  async removeMember(clubId: string, userId: string): Promise<void> {
    await pool.query(
      'DELETE FROM club_memberships WHERE club_id = $1 AND user_id = $2',
      [clubId, userId]
    );
  }

  // ===== JOIN REQUESTS =====

  async createJoinRequest(clubId: string, userId: string): Promise<ClubJoinRequest> {
    const query = `
      INSERT INTO club_join_requests (club_id, user_id, status)
      VALUES ($1, $2, 'pending')
      ON CONFLICT (club_id, user_id) DO UPDATE SET status = 'pending', created_at = NOW()
      RETURNING *
    `;
    const result = await pool.query(query, [clubId, userId]);
    return result.rows[0];
  }

  async getJoinRequest(clubId: string, userId: string): Promise<ClubJoinRequest | null> {
    const query = 'SELECT * FROM club_join_requests WHERE club_id = $1 AND user_id = $2';
    const result = await pool.query(query, [clubId, userId]);
    return result.rows[0] || null;
  }

  async getPendingRequests(clubId: string): Promise<ClubJoinRequest[]> {
    const query = `
      SELECT jr.*, u.username, u.avatar_url
      FROM club_join_requests jr
      JOIN users u ON jr.user_id = u.user_id
      WHERE jr.club_id = $1 AND jr.status = 'pending'
      ORDER BY jr.created_at ASC
    `;
    const result = await pool.query(query, [clubId]);
    return result.rows;
  }

  async updateJoinRequestStatus(requestId: string, status: 'approved' | 'rejected'): Promise<void> {
    await pool.query(
      'UPDATE club_join_requests SET status = $1 WHERE request_id = $2',
      [status, requestId]
    );
  }

  // ===== CHIP TRANSACTIONS =====

  async createChipTransaction(data: {
    club_id: string;
    type: string;
    from_user_id?: string;
    to_user_id: string;
    amount: number;
    balance_after: number;
    reason?: string;
  }): Promise<void> {
    const query = `
      INSERT INTO club_chip_transactions
      (club_id, type, from_user_id, to_user_id, amount, balance_after, reason)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;
    await pool.query(query, [
      data.club_id,
      data.type,
      data.from_user_id || null,
      data.to_user_id,
      data.amount,
      data.balance_after,
      data.reason || null,
    ]);
  }

  async getChipTransactions(clubId: string, userId: string, limit: number = 50): Promise<any[]> {
    const query = `
      SELECT * FROM club_chip_transactions
      WHERE club_id = $1 AND (from_user_id = $2 OR to_user_id = $2)
      ORDER BY created_at DESC
      LIMIT $3
    `;
    const result = await pool.query(query, [clubId, userId, limit]);
    return result.rows;
  }

  // ===== TABLES =====

  async createTable(data: {
    club_id: string;
    creator_user_id: string;
    stake_amount: number;
    privacy?: 'public' | 'private';
  }): Promise<ClubTable> {
    const query = `
      INSERT INTO club_tables (club_id, creator_user_id, stake_amount, privacy)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const result = await pool.query(query, [
      data.club_id,
      data.creator_user_id,
      data.stake_amount,
      data.privacy || 'public',
    ]);
    return result.rows[0];
  }

  async getTables(clubId: string): Promise<ClubTable[]> {
    const query = `
      SELECT ct.*, u.username as creator_username
      FROM club_tables ct
      JOIN users u ON ct.creator_user_id = u.user_id
      WHERE ct.club_id = $1 AND ct.status IN ('waiting', 'started')
      ORDER BY ct.created_at DESC
    `;
    const result = await pool.query(query, [clubId]);
    return result.rows;
  }

  async getTable(tableId: string): Promise<ClubTable | null> {
    const query = `
      SELECT ct.*, u.username as creator_username
      FROM club_tables ct
      JOIN users u ON ct.creator_user_id = u.user_id
      WHERE ct.table_id = $1
    `;
    const result = await pool.query(query, [tableId]);
    return result.rows[0] || null;
  }

  async updateTableStatus(tableId: string, status: string, matchId?: string): Promise<void> {
    await pool.query(
      'UPDATE club_tables SET status = $1, match_id = $2 WHERE table_id = $3',
      [status, matchId || null, tableId]
    );
  }

  async cancelTable(tableId: string): Promise<void> {
    await pool.query(
      "UPDATE club_tables SET status = 'cancelled' WHERE table_id = $1",
      [tableId]
    );
  }
}

export const clubsRepository = new ClubsRepository();
