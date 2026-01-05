# 🏛️ LANE 6: CLUB SYSTEM (FIXED)
## Clubs, Chip Economy, and Social Features
## ✅ ALL ISSUES PATCHED

---

## YOUR MISSION
Build the complete club system:
- Backend: Club CRUD, membership, chip management
- Frontend: Club discovery, lobby, chat, tables
- Features: Create clubs, join clubs, grant chips, play with chips

---

## PREREQUISITES
- **Lane 1 must be complete** (backend running)
- **Lane 2 must be complete** (frontend running)
- **Lane 4 helpful** (WebSocket for real-time chat)
- **Lane 5 helpful** (gold economy for club creation cost)

---

## PHASE 1: Backend Club Types

### Step 1.1: Create Club Types
Create `src/types/club.types.ts` in backend:
```typescript
export interface Club {
  club_id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  owner_id: string;
  privacy: 'public' | 'private';
  welcome_bonus: number;
  member_count: number;
  total_chips_in_circulation: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ClubMembership {
  membership_id: string;
  club_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  chip_balance: number;
  matches_played: number;
  matches_won: number;
  joined_at: Date;
  // Joined fields from users table
  username?: string;
  avatar_url?: string;
  level?: number;
}

export interface CreateClubData {
  name: string;
  description?: string;
  logo_url?: string;
  privacy?: 'public' | 'private';
  welcome_bonus?: number;
}

export interface ClubTable {
  table_id: string;
  club_id: string;
  creator_user_id: string;
  stake_amount: number;
  privacy: 'public' | 'private';
  status: 'waiting' | 'started' | 'cancelled';
  match_id: string | null;
  created_at: Date;
  // Joined fields
  creator_username?: string;
}

export interface ClubJoinRequest {
  request_id: string;
  club_id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: Date;
  // Joined fields
  username?: string;
  avatar_url?: string;
}

export interface ChipTransaction {
  transaction_id: string;
  club_id: string;
  type: 'welcome_bonus' | 'grant' | 'match_win' | 'match_loss' | 'admin_adjust';
  from_user_id: string | null;
  to_user_id: string;
  amount: number;
  balance_after: number;
  reason: string | null;
  created_at: Date;
}
```

---

## PHASE 2: Backend Club Repository

### Step 2.1: Create Clubs Repository
Create `src/repositories/clubs.repository.ts`:
```typescript
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
```

---

## PHASE 3: Backend Club Service

### Step 3.1: Create Clubs Service
Create `src/services/clubs.service.ts`:
```typescript
import pool from '../db/connection';
import { clubsRepository } from '../repositories/clubs.repository';
import { usersRepository } from '../repositories/users.repository';
import { goldRepository } from '../repositories/gold.repository';
import { Club, CreateClubData, ClubMembership, ClubTable } from '../types/club.types';
import { ValidationError, NotFoundError, ForbiddenError } from '../errors/AppError';

// Configuration
const CLUB_CREATION_COST = 50000; // Gold required to create a club
const MAX_CHIP_GRANT_AMOUNT = 10000; // Maximum chips per grant

export class ClubsService {
  // ===== CLUB CRUD =====

  async createClub(userId: string, data: CreateClubData): Promise<Club> {
    // Check gold balance
    const user = await usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User');
    }
    
    if (user.gold_balance < CLUB_CREATION_COST) {
      throw new ValidationError(`Requires ${CLUB_CREATION_COST.toLocaleString()} gold to create a club. You have ${user.gold_balance.toLocaleString()}.`);
    }

    // Validate name
    if (!data.name || data.name.trim().length < 3) {
      throw new ValidationError('Club name must be at least 3 characters');
    }
    if (data.name.trim().length > 50) {
      throw new ValidationError('Club name must be at most 50 characters');
    }

    // Check name uniqueness
    const existing = await clubsRepository.findByName(data.name);
    if (existing) {
      throw new ValidationError('Club name already exists');
    }

    // Validate welcome bonus
    if (data.welcome_bonus !== undefined) {
      if (data.welcome_bonus < 0 || data.welcome_bonus > 100000) {
        throw new ValidationError('Welcome bonus must be between 0 and 100,000');
      }
    }

    // Start transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Deduct gold
      const newGoldBalance = user.gold_balance - CLUB_CREATION_COST;
      await client.query(
        'UPDATE users SET gold_balance = $1, total_gold_spent = total_gold_spent + $2 WHERE user_id = $3',
        [newGoldBalance, CLUB_CREATION_COST, userId]
      );

      // Record gold transaction
      await goldRepository.createTransaction({
        user_id: userId,
        type: 'club_creation',
        amount: -CLUB_CREATION_COST,
        balance_after: newGoldBalance,
        description: `Created club: ${data.name}`,
      });

      // Create club
      const club = await clubsRepository.create({
        ...data,
        owner_id: userId,
      });

      // Add owner as first member with welcome bonus
      const welcomeBonus = data.welcome_bonus || 0;
      await clubsRepository.createMembership({
        club_id: club.club_id,
        user_id: userId,
        role: 'owner',
        chip_balance: welcomeBonus,
      });

      // Record chip transaction if welcome bonus > 0
      if (welcomeBonus > 0) {
        await clubsRepository.createChipTransaction({
          club_id: club.club_id,
          type: 'welcome_bonus',
          to_user_id: userId,
          amount: welcomeBonus,
          balance_after: welcomeBonus,
          reason: 'Club creation welcome bonus',
        });
      }

      await client.query('COMMIT');
      return club;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getClub(clubId: string): Promise<Club> {
    const club = await clubsRepository.findById(clubId);
    if (!club) {
      throw new NotFoundError('Club');
    }
    return club;
  }

  async searchClubs(options: {
    search?: string;
    privacy?: string;
    limit?: number;
    offset?: number;
  }) {
    return clubsRepository.search(options);
  }

  async updateClub(userId: string, clubId: string, data: Partial<CreateClubData>): Promise<Club> {
    const club = await this.getClub(clubId);
    const membership = await clubsRepository.getMembership(clubId, userId);

    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      throw new ForbiddenError('Only owner or admin can update club');
    }

    // Only owner can change certain settings
    if (membership.role !== 'owner') {
      if (data.privacy !== undefined || data.welcome_bonus !== undefined) {
        throw new ForbiddenError('Only owner can change privacy and welcome bonus');
      }
    }

    // Validate name if changing
    if (data.name && data.name !== club.name) {
      const existing = await clubsRepository.findByName(data.name);
      if (existing) {
        throw new ValidationError('Club name already exists');
      }
    }

    return clubsRepository.update(clubId, data);
  }

  // ===== MEMBERSHIP =====

  async joinClub(userId: string, clubId: string): Promise<ClubMembership> {
    const club = await this.getClub(clubId);
    
    // Check if already a member
    const existing = await clubsRepository.getMembership(clubId, userId);
    if (existing) {
      throw new ValidationError('Already a member of this club');
    }

    // Handle private clubs
    if (club.privacy === 'private') {
      // Check for existing request
      const existingRequest = await clubsRepository.getJoinRequest(clubId, userId);
      if (existingRequest?.status === 'pending') {
        throw new ValidationError('Join request already pending');
      }

      // Create join request
      await clubsRepository.createJoinRequest(clubId, userId);
      throw new ValidationError('Join request sent. Waiting for approval.', { request_sent: true });
    }

    // Public club - join directly
    const membership = await clubsRepository.createMembership({
      club_id: clubId,
      user_id: userId,
      role: 'member',
      chip_balance: club.welcome_bonus,
    });

    await clubsRepository.incrementMemberCount(clubId);

    // Record welcome bonus transaction
    if (club.welcome_bonus > 0) {
      await clubsRepository.createChipTransaction({
        club_id: clubId,
        type: 'welcome_bonus',
        to_user_id: userId,
        amount: club.welcome_bonus,
        balance_after: club.welcome_bonus,
        reason: 'Welcome bonus for joining club',
      });
    }

    return membership;
  }

  async leaveClub(userId: string, clubId: string): Promise<void> {
    const membership = await clubsRepository.getMembership(clubId, userId);
    if (!membership) {
      throw new ValidationError('Not a member of this club');
    }

    if (membership.role === 'owner') {
      throw new ValidationError('Owner cannot leave club. Transfer ownership first or delete the club.');
    }

    await clubsRepository.removeMember(clubId, userId);
    await clubsRepository.decrementMemberCount(clubId);
  }

  async getMembers(clubId: string, options?: {
    search?: string;
    sort?: 'chips' | 'name' | 'joined';
    limit?: number;
    offset?: number;
  }) {
    await this.getClub(clubId); // Verify club exists
    return clubsRepository.getMembers(clubId, options);
  }

  async getUserClubs(userId: string) {
    const clubs = await clubsRepository.getUserClubs(userId);
    return { clubs };
  }

  async getMembership(clubId: string, userId: string): Promise<ClubMembership | null> {
    return clubsRepository.getMembership(clubId, userId);
  }

  // ===== JOIN REQUESTS =====

  async getPendingRequests(userId: string, clubId: string) {
    const membership = await clubsRepository.getMembership(clubId, userId);
    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      throw new ForbiddenError('Only owner or admin can view requests');
    }

    const requests = await clubsRepository.getPendingRequests(clubId);
    return { requests };
  }

  async approveRequest(adminUserId: string, clubId: string, requestUserId: string): Promise<ClubMembership> {
    const membership = await clubsRepository.getMembership(clubId, adminUserId);
    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      throw new ForbiddenError('Only owner or admin can approve requests');
    }

    const request = await clubsRepository.getJoinRequest(clubId, requestUserId);
    if (!request || request.status !== 'pending') {
      throw new ValidationError('No pending request found');
    }

    const club = await this.getClub(clubId);

    // Create membership
    const newMembership = await clubsRepository.createMembership({
      club_id: clubId,
      user_id: requestUserId,
      role: 'member',
      chip_balance: club.welcome_bonus,
    });

    await clubsRepository.updateJoinRequestStatus(request.request_id, 'approved');
    await clubsRepository.incrementMemberCount(clubId);

    // Record welcome bonus
    if (club.welcome_bonus > 0) {
      await clubsRepository.createChipTransaction({
        club_id: clubId,
        type: 'welcome_bonus',
        to_user_id: requestUserId,
        amount: club.welcome_bonus,
        balance_after: club.welcome_bonus,
        reason: 'Welcome bonus for joining club',
      });
    }

    return newMembership;
  }

  async rejectRequest(adminUserId: string, clubId: string, requestUserId: string): Promise<void> {
    const membership = await clubsRepository.getMembership(clubId, adminUserId);
    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      throw new ForbiddenError('Only owner or admin can reject requests');
    }

    const request = await clubsRepository.getJoinRequest(clubId, requestUserId);
    if (!request || request.status !== 'pending') {
      throw new ValidationError('No pending request found');
    }

    await clubsRepository.updateJoinRequestStatus(request.request_id, 'rejected');
  }

  // ===== CHIP MANAGEMENT =====

  async grantChips(
    granterId: string,
    clubId: string,
    recipientId: string,
    amount: number,
    reason?: string
  ): Promise<{ new_balance: number }> {
    if (amount <= 0) {
      throw new ValidationError('Amount must be positive');
    }

    if (amount > MAX_CHIP_GRANT_AMOUNT) {
      throw new ValidationError(`Maximum grant amount is ${MAX_CHIP_GRANT_AMOUNT.toLocaleString()} chips`);
    }

    const granterMembership = await clubsRepository.getMembership(clubId, granterId);
    if (!granterMembership || (granterMembership.role !== 'owner' && granterMembership.role !== 'admin')) {
      throw new ForbiddenError('Only owner or admin can grant chips');
    }

    const recipientMembership = await clubsRepository.getMembership(clubId, recipientId);
    if (!recipientMembership) {
      throw new ValidationError('Recipient is not a member of this club');
    }

    const newBalance = await clubsRepository.updateMemberChips(clubId, recipientId, amount);

    await clubsRepository.createChipTransaction({
      club_id: clubId,
      type: 'grant',
      from_user_id: granterId,
      to_user_id: recipientId,
      amount: amount,
      balance_after: newBalance,
      reason: reason || 'Chip grant from admin',
    });

    // Update club's total chips in circulation
    await pool.query(
      'UPDATE clubs SET total_chips_in_circulation = total_chips_in_circulation + $1 WHERE club_id = $2',
      [amount, clubId]
    );

    return { new_balance: newBalance };
  }

  async getChipBalance(userId: string, clubId: string): Promise<{ balance: number }> {
    const membership = await clubsRepository.getMembership(clubId, userId);
    if (!membership) {
      throw new ValidationError('Not a member of this club');
    }
    return { balance: membership.chip_balance };
  }

  // ===== ADMIN FUNCTIONS =====

  async promoteToAdmin(ownerId: string, clubId: string, targetUserId: string): Promise<void> {
    const ownerMembership = await clubsRepository.getMembership(clubId, ownerId);
    if (!ownerMembership || ownerMembership.role !== 'owner') {
      throw new ForbiddenError('Only owner can promote members');
    }

    const targetMembership = await clubsRepository.getMembership(clubId, targetUserId);
    if (!targetMembership) {
      throw new ValidationError('User is not a member');
    }

    if (targetMembership.role === 'owner') {
      throw new ValidationError('Cannot change owner role');
    }

    await clubsRepository.updateMemberRole(clubId, targetUserId, 'admin');
  }

  async demoteFromAdmin(ownerId: string, clubId: string, targetUserId: string): Promise<void> {
    const ownerMembership = await clubsRepository.getMembership(clubId, ownerId);
    if (!ownerMembership || ownerMembership.role !== 'owner') {
      throw new ForbiddenError('Only owner can demote admins');
    }

    const targetMembership = await clubsRepository.getMembership(clubId, targetUserId);
    if (!targetMembership || targetMembership.role !== 'admin') {
      throw new ValidationError('User is not an admin');
    }

    await clubsRepository.updateMemberRole(clubId, targetUserId, 'member');
  }

  async kickMember(adminId: string, clubId: string, targetUserId: string): Promise<void> {
    const adminMembership = await clubsRepository.getMembership(clubId, adminId);
    if (!adminMembership || (adminMembership.role !== 'owner' && adminMembership.role !== 'admin')) {
      throw new ForbiddenError('Only owner or admin can kick members');
    }

    const targetMembership = await clubsRepository.getMembership(clubId, targetUserId);
    if (!targetMembership) {
      throw new ValidationError('User is not a member');
    }

    // Admins can't kick other admins or owner
    if (adminMembership.role === 'admin' && targetMembership.role !== 'member') {
      throw new ForbiddenError('Admins can only kick regular members');
    }

    // Owner can't be kicked
    if (targetMembership.role === 'owner') {
      throw new ForbiddenError('Cannot kick club owner');
    }

    await clubsRepository.removeMember(clubId, targetUserId);
    await clubsRepository.decrementMemberCount(clubId);
  }

  // ===== TABLES =====

  async createTable(userId: string, clubId: string, stakeAmount: number): Promise<ClubTable> {
    const membership = await clubsRepository.getMembership(clubId, userId);
    if (!membership) {
      throw new ValidationError('Not a member of this club');
    }

    if (stakeAmount <= 0) {
      throw new ValidationError('Stake amount must be positive');
    }

    if (membership.chip_balance < stakeAmount) {
      throw new ValidationError(`Insufficient chips. You have ${membership.chip_balance}, need ${stakeAmount}`);
    }

    return clubsRepository.createTable({
      club_id: clubId,
      creator_user_id: userId,
      stake_amount: stakeAmount,
    });
  }

  async getTables(clubId: string) {
    await this.getClub(clubId);
    const tables = await clubsRepository.getTables(clubId);
    return { tables };
  }

  async cancelTable(userId: string, tableId: string): Promise<void> {
    const table = await clubsRepository.getTable(tableId);
    if (!table) {
      throw new NotFoundError('Table');
    }

    if (table.creator_user_id !== userId) {
      const membership = await clubsRepository.getMembership(table.club_id, userId);
      if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
        throw new ForbiddenError('Only table creator or admin can cancel');
      }
    }

    if (table.status !== 'waiting') {
      throw new ValidationError('Can only cancel waiting tables');
    }

    await clubsRepository.cancelTable(tableId);
  }

  // ===== LEADERBOARD =====

  async getLeaderboard(clubId: string, limit: number = 10) {
    await this.getClub(clubId);
    const { members } = await clubsRepository.getMembers(clubId, {
      sort: 'chips',
      limit,
    });

    return {
      leaderboard: members.map((m, index) => ({
        rank: index + 1,
        user_id: m.user_id,
        username: m.username,
        avatar_url: m.avatar_url,
        chip_balance: m.chip_balance,
        matches_won: m.matches_won,
      })),
    };
  }
}

export const clubsService = new ClubsService();
```

---

## PHASE 4: Backend Controller & Routes

### Step 4.1: Create Club Validators
Create `src/validators/club.validator.ts`:
```typescript
import { z } from 'zod';

export const createClubSchema = z.object({
  name: z.string()
    .min(3, 'Name must be at least 3 characters')
    .max(50, 'Name must be at most 50 characters'),
  description: z.string().max(500).optional(),
  logo_url: z.string().url().optional().nullable(),
  privacy: z.enum(['public', 'private']).optional(),
  welcome_bonus: z.number().min(0).max(100000).optional(),
});

export const updateClubSchema = z.object({
  name: z.string().min(3).max(50).optional(),
  description: z.string().max(500).optional().nullable(),
  logo_url: z.string().url().optional().nullable(),
  privacy: z.enum(['public', 'private']).optional(),
  welcome_bonus: z.number().min(0).max(100000).optional(),
});

export const grantChipsSchema = z.object({
  user_id: z.string().uuid(),
  amount: z.number().positive().max(10000),
  reason: z.string().max(200).optional(),
});

export const createTableSchema = z.object({
  stake_amount: z.number().positive(),
});
```

### Step 4.2: Create Club Controller
Create `src/controllers/clubs.controller.ts`:
```typescript
import { Request, Response, NextFunction } from 'express';
import { clubsService } from '../services/clubs.service';

export class ClubsController {
  // ===== CLUBS =====

  async createClub(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const club = await clubsService.createClub(req.user!.userId, req.body);
      res.status(201).json({ success: true, club });
    } catch (error) {
      next(error);
    }
  }

  async getClub(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const club = await clubsService.getClub(req.params.clubId);
      
      // Get user's membership if authenticated
      let membership = null;
      if (req.user) {
        membership = await clubsService.getMembership(req.params.clubId, req.user.userId);
      }
      
      res.status(200).json({ success: true, club, membership });
    } catch (error) {
      next(error);
    }
  }

  async searchClubs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { search, privacy, limit, offset } = req.query;
      const result = await clubsService.searchClubs({
        search: search as string,
        privacy: privacy as string,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async updateClub(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const club = await clubsService.updateClub(req.user!.userId, req.params.clubId, req.body);
      res.status(200).json({ success: true, club });
    } catch (error) {
      next(error);
    }
  }

  async getUserClubs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await clubsService.getUserClubs(req.user!.userId);
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  // ===== MEMBERSHIP =====

  async joinClub(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const membership = await clubsService.joinClub(req.user!.userId, req.params.clubId);
      res.status(201).json({ success: true, membership });
    } catch (error) {
      next(error);
    }
  }

  async leaveClub(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await clubsService.leaveClub(req.user!.userId, req.params.clubId);
      res.status(200).json({ success: true, message: 'Left club successfully' });
    } catch (error) {
      next(error);
    }
  }

  async getMembers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { search, sort, limit, offset } = req.query;
      const result = await clubsService.getMembers(req.params.clubId, {
        search: search as string,
        sort: sort as 'chips' | 'name' | 'joined',
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  // ===== JOIN REQUESTS =====

  async getPendingRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await clubsService.getPendingRequests(req.user!.userId, req.params.clubId);
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async approveRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const membership = await clubsService.approveRequest(
        req.user!.userId,
        req.params.clubId,
        req.params.userId
      );
      res.status(200).json({ success: true, membership });
    } catch (error) {
      next(error);
    }
  }

  async rejectRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await clubsService.rejectRequest(
        req.user!.userId,
        req.params.clubId,
        req.params.userId
      );
      res.status(200).json({ success: true, message: 'Request rejected' });
    } catch (error) {
      next(error);
    }
  }

  // ===== CHIPS =====

  async grantChips(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { user_id, amount, reason } = req.body;
      const result = await clubsService.grantChips(
        req.user!.userId,
        req.params.clubId,
        user_id,
        amount,
        reason
      );
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async getChipBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await clubsService.getChipBalance(req.user!.userId, req.params.clubId);
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  // ===== ADMIN =====

  async promoteToAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await clubsService.promoteToAdmin(req.user!.userId, req.params.clubId, req.params.userId);
      res.status(200).json({ success: true, message: 'User promoted to admin' });
    } catch (error) {
      next(error);
    }
  }

  async demoteFromAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await clubsService.demoteFromAdmin(req.user!.userId, req.params.clubId, req.params.userId);
      res.status(200).json({ success: true, message: 'User demoted to member' });
    } catch (error) {
      next(error);
    }
  }

  async kickMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await clubsService.kickMember(req.user!.userId, req.params.clubId, req.params.userId);
      res.status(200).json({ success: true, message: 'Member kicked' });
    } catch (error) {
      next(error);
    }
  }

  // ===== TABLES =====

  async createTable(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const table = await clubsService.createTable(
        req.user!.userId,
        req.params.clubId,
        req.body.stake_amount
      );
      res.status(201).json({ success: true, table });
    } catch (error) {
      next(error);
    }
  }

  async getTables(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await clubsService.getTables(req.params.clubId);
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async cancelTable(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await clubsService.cancelTable(req.user!.userId, req.params.tableId);
      res.status(200).json({ success: true, message: 'Table cancelled' });
    } catch (error) {
      next(error);
    }
  }

  // ===== LEADERBOARD =====

  async getLeaderboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const result = await clubsService.getLeaderboard(req.params.clubId, limit);
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }
}

export const clubsController = new ClubsController();
```

### Step 4.3: Create Club Routes
Create `src/routes/clubs.routes.ts`:
```typescript
import { Router } from 'express';
import { clubsController } from '../controllers/clubs.controller';
import { authMiddleware, optionalAuth } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { createClubSchema, updateClubSchema, grantChipsSchema, createTableSchema } from '../validators/club.validator';

const router = Router();

// Public routes (with optional auth for membership info)
router.get('/', optionalAuth, clubsController.searchClubs.bind(clubsController));
router.get('/:clubId', optionalAuth, clubsController.getClub.bind(clubsController));
router.get('/:clubId/members', clubsController.getMembers.bind(clubsController));
router.get('/:clubId/leaderboard', clubsController.getLeaderboard.bind(clubsController));
router.get('/:clubId/tables', clubsController.getTables.bind(clubsController));

// Protected routes - require authentication
router.use(authMiddleware);

// User's clubs
router.get('/user/my-clubs', clubsController.getUserClubs.bind(clubsController));

// Club management
router.post('/', validateRequest(createClubSchema), clubsController.createClub.bind(clubsController));
router.patch('/:clubId', validateRequest(updateClubSchema), clubsController.updateClub.bind(clubsController));

// Membership
router.post('/:clubId/join', clubsController.joinClub.bind(clubsController));
router.post('/:clubId/leave', clubsController.leaveClub.bind(clubsController));

// Join requests (for private clubs)
router.get('/:clubId/requests', clubsController.getPendingRequests.bind(clubsController));
router.post('/:clubId/requests/:userId/approve', clubsController.approveRequest.bind(clubsController));
router.post('/:clubId/requests/:userId/reject', clubsController.rejectRequest.bind(clubsController));

// Chips
router.get('/:clubId/chips/balance', clubsController.getChipBalance.bind(clubsController));
router.post('/:clubId/chips/grant', validateRequest(grantChipsSchema), clubsController.grantChips.bind(clubsController));

// Admin functions
router.post('/:clubId/members/:userId/promote', clubsController.promoteToAdmin.bind(clubsController));
router.post('/:clubId/members/:userId/demote', clubsController.demoteFromAdmin.bind(clubsController));
router.post('/:clubId/members/:userId/kick', clubsController.kickMember.bind(clubsController));

// Tables
router.post('/:clubId/tables', validateRequest(createTableSchema), clubsController.createTable.bind(clubsController));
router.post('/tables/:tableId/cancel', clubsController.cancelTable.bind(clubsController));

export default router;
```

### Step 4.4: Register Routes in Index
Update `src/routes/index.ts` to include clubs:
```typescript
import { Router } from 'express';
import authRoutes from './auth.routes';
import goldRoutes from './gold.routes';     // From Lane 5
import clubsRoutes from './clubs.routes';   // NEW

const router = Router();

// Health check
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Route modules
router.use('/auth', authRoutes);
router.use('/gold', goldRoutes);   // From Lane 5
router.use('/clubs', clubsRoutes); // NEW

export default router;
```

---

## PHASE 5: Frontend Club Store

### Step 5.1: Create Club Types
Create `types/club.types.ts` in frontend:
```typescript
export interface Club {
  club_id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  owner_id: string;
  privacy: 'public' | 'private';
  welcome_bonus: number;
  member_count: number;
  is_active: boolean;
}

export interface ClubMembership {
  membership_id: string;
  club_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  chip_balance: number;
  username?: string;
  avatar_url?: string;
}

export interface ClubTable {
  table_id: string;
  club_id: string;
  creator_user_id: string;
  creator_username?: string;
  stake_amount: number;
  status: 'waiting' | 'started';
}

export interface ClubWithMembership extends Club {
  chip_balance: number;
  role: string;
}
```

### Step 5.2: Create Club API Service
Create `services/api/clubsApi.ts`:
```typescript
import apiClient from './axiosInstance';
import { Club, ClubMembership, ClubTable, ClubWithMembership } from '../../types/club.types';

export interface CreateClubData {
  name: string;
  description?: string;
  privacy?: 'public' | 'private';
  welcome_bonus?: number;
}

export const clubsApi = {
  // Search/discover clubs
  searchClubs: (params?: { search?: string; privacy?: string; limit?: number; offset?: number }) =>
    apiClient.get<{ success: boolean; clubs: Club[]; total: number }>('/clubs', { params }),

  // Get single club
  getClub: (clubId: string) =>
    apiClient.get<{ success: boolean; club: Club; membership: ClubMembership | null }>(`/clubs/${clubId}`),

  // Get user's clubs
  getMyClubs: () =>
    apiClient.get<{ success: boolean; clubs: ClubWithMembership[] }>('/clubs/user/my-clubs'),

  // Create club
  createClub: (data: CreateClubData) =>
    apiClient.post<{ success: boolean; club: Club }>('/clubs', data),

  // Join club
  joinClub: (clubId: string) =>
    apiClient.post<{ success: boolean; membership: ClubMembership }>(`/clubs/${clubId}/join`),

  // Leave club
  leaveClub: (clubId: string) =>
    apiClient.post<{ success: boolean }>(`/clubs/${clubId}/leave`),

  // Get members
  getMembers: (clubId: string, params?: { sort?: string; limit?: number }) =>
    apiClient.get<{ success: boolean; members: ClubMembership[]; total: number }>(`/clubs/${clubId}/members`, { params }),

  // Get chip balance
  getChipBalance: (clubId: string) =>
    apiClient.get<{ success: boolean; balance: number }>(`/clubs/${clubId}/chips/balance`),

  // Grant chips (admin only)
  grantChips: (clubId: string, userId: string, amount: number, reason?: string) =>
    apiClient.post<{ success: boolean; new_balance: number }>(`/clubs/${clubId}/chips/grant`, {
      user_id: userId,
      amount,
      reason,
    }),

  // Get tables
  getTables: (clubId: string) =>
    apiClient.get<{ success: boolean; tables: ClubTable[] }>(`/clubs/${clubId}/tables`),

  // Create table
  createTable: (clubId: string, stakeAmount: number) =>
    apiClient.post<{ success: boolean; table: ClubTable }>(`/clubs/${clubId}/tables`, {
      stake_amount: stakeAmount,
    }),

  // Get leaderboard
  getLeaderboard: (clubId: string, limit?: number) =>
    apiClient.get<{ success: boolean; leaderboard: any[] }>(`/clubs/${clubId}/leaderboard`, {
      params: { limit },
    }),
};
```

### Step 5.3: Create Club Store
Create `store/clubStore.ts`:
```typescript
import { create } from 'zustand';
import { Club, ClubMembership, ClubWithMembership, ClubTable } from '../types/club.types';
import { clubsApi, CreateClubData } from '../services/api/clubsApi';

interface ClubState {
  // User's clubs
  myClubs: ClubWithMembership[];
  myClubsLoading: boolean;
  
  // Club discovery
  discoveredClubs: Club[];
  discoveredClubsTotal: number;
  discoveryLoading: boolean;
  
  // Current club (for lobby view)
  currentClub: Club | null;
  currentMembership: ClubMembership | null;
  currentMembers: ClubMembership[];
  currentTables: ClubTable[];
  currentClubLoading: boolean;
  
  // Actions
  fetchMyClubs: () => Promise<void>;
  searchClubs: (search?: string) => Promise<void>;
  fetchClubDetails: (clubId: string) => Promise<void>;
  fetchMembers: (clubId: string) => Promise<void>;
  fetchTables: (clubId: string) => Promise<void>;
  createClub: (data: CreateClubData) => Promise<Club>;
  joinClub: (clubId: string) => Promise<void>;
  leaveClub: (clubId: string) => Promise<void>;
  clearCurrentClub: () => void;
}

export const useClubStore = create<ClubState>((set, get) => ({
  myClubs: [],
  myClubsLoading: false,
  discoveredClubs: [],
  discoveredClubsTotal: 0,
  discoveryLoading: false,
  currentClub: null,
  currentMembership: null,
  currentMembers: [],
  currentTables: [],
  currentClubLoading: false,

  fetchMyClubs: async () => {
    set({ myClubsLoading: true });
    try {
      const { data } = await clubsApi.getMyClubs();
      set({ myClubs: data.clubs, myClubsLoading: false });
    } catch (error) {
      set({ myClubsLoading: false });
      throw error;
    }
  },

  searchClubs: async (search?: string) => {
    set({ discoveryLoading: true });
    try {
      const { data } = await clubsApi.searchClubs({ search, limit: 20 });
      set({
        discoveredClubs: data.clubs,
        discoveredClubsTotal: data.total,
        discoveryLoading: false,
      });
    } catch (error) {
      set({ discoveryLoading: false });
      throw error;
    }
  },

  fetchClubDetails: async (clubId: string) => {
    set({ currentClubLoading: true });
    try {
      const { data } = await clubsApi.getClub(clubId);
      set({
        currentClub: data.club,
        currentMembership: data.membership,
        currentClubLoading: false,
      });
    } catch (error) {
      set({ currentClubLoading: false });
      throw error;
    }
  },

  fetchMembers: async (clubId: string) => {
    try {
      const { data } = await clubsApi.getMembers(clubId, { limit: 50 });
      set({ currentMembers: data.members });
    } catch (error) {
      console.error('Failed to fetch members:', error);
    }
  },

  fetchTables: async (clubId: string) => {
    try {
      const { data } = await clubsApi.getTables(clubId);
      set({ currentTables: data.tables });
    } catch (error) {
      console.error('Failed to fetch tables:', error);
    }
  },

  createClub: async (data: CreateClubData) => {
    const { data: result } = await clubsApi.createClub(data);
    // Refresh my clubs list
    await get().fetchMyClubs();
    return result.club;
  },

  joinClub: async (clubId: string) => {
    await clubsApi.joinClub(clubId);
    // Refresh data
    await Promise.all([
      get().fetchMyClubs(),
      get().fetchClubDetails(clubId),
    ]);
  },

  leaveClub: async (clubId: string) => {
    await clubsApi.leaveClub(clubId);
    await get().fetchMyClubs();
    set({ currentMembership: null });
  },

  clearCurrentClub: () => {
    set({
      currentClub: null,
      currentMembership: null,
      currentMembers: [],
      currentTables: [],
    });
  },
}));
```

---

## PHASE 6: Frontend Clubs Tab

### Step 6.1: Update Clubs Tab
Replace `app/(tabs)/clubs.tsx`:
```typescript
import { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useClubStore } from '../../store/clubStore';
import { Club, ClubWithMembership } from '../../types/club.types';

type TabType = 'my' | 'discover';

export default function ClubsTab() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('my');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const {
    myClubs,
    myClubsLoading,
    discoveredClubs,
    discoveryLoading,
    fetchMyClubs,
    searchClubs,
  } = useClubStore();

  useEffect(() => {
    fetchMyClubs();
    searchClubs();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchMyClubs(), searchClubs(searchQuery)]);
    setRefreshing(false);
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    searchClubs(text);
  };

  const renderMyClubItem = ({ item }: { item: ClubWithMembership }) => (
    <TouchableOpacity
      style={styles.clubCard}
      onPress={() => router.push(`/club/${item.club_id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.clubIcon}>
        <Text style={styles.clubIconText}>
          {item.name.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.clubInfo}>
        <Text style={styles.clubName}>{item.name}</Text>
        <Text style={styles.clubMeta}>
          {item.member_count} members • {item.role}
        </Text>
      </View>
      <View style={styles.chipBalance}>
        <Text style={styles.chipIcon}>🎰</Text>
        <Text style={styles.chipAmount}>{item.chip_balance.toLocaleString()}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderDiscoverClubItem = ({ item }: { item: Club }) => (
    <TouchableOpacity
      style={styles.clubCard}
      onPress={() => router.push(`/club/${item.club_id}`)}
      activeOpacity={0.7}
    >
      <View style={[styles.clubIcon, { backgroundColor: '#10B981' }]}>
        <Text style={styles.clubIconText}>
          {item.name.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.clubInfo}>
        <Text style={styles.clubName}>{item.name}</Text>
        <Text style={styles.clubMeta}>
          {item.member_count} members • {item.privacy === 'private' ? '🔒 Private' : 'Public'}
        </Text>
        {item.welcome_bonus > 0 && (
          <Text style={styles.welcomeBonus}>
            🎁 {item.welcome_bonus.toLocaleString()} chips welcome bonus!
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color="#ccc" />
    </TouchableOpacity>
  );

  const isLoading = activeTab === 'my' ? myClubsLoading : discoveryLoading;
  const data = activeTab === 'my' ? myClubs : discoveredClubs;

  return (
    <View style={styles.container}>
      {/* Tab Switcher */}
      <View style={styles.tabSwitcher}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'my' && styles.tabActive]}
          onPress={() => setActiveTab('my')}
        >
          <Text style={[styles.tabText, activeTab === 'my' && styles.tabTextActive]}>
            My Clubs
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'discover' && styles.tabActive]}
          onPress={() => setActiveTab('discover')}
        >
          <Text style={[styles.tabText, activeTab === 'discover' && styles.tabTextActive]}>
            Discover
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search (only for discover) */}
      {activeTab === 'discover' && (
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search clubs..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={handleSearch}
          />
        </View>
      )}

      {/* List */}
      {isLoading && data.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
        </View>
      ) : data.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons 
            name={activeTab === 'my' ? 'people-outline' : 'search-outline'} 
            size={64} 
            color="#ccc" 
          />
          <Text style={styles.emptyTitle}>
            {activeTab === 'my' ? 'No Clubs Yet' : 'No Clubs Found'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {activeTab === 'my' 
              ? 'Join or create a club to get started!' 
              : 'Try a different search term'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.club_id}
          renderItem={activeTab === 'my' ? renderMyClubItem : renderDiscoverClubItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        />
      )}

      {/* Create Club FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/club/create')}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  tabSwitcher: { 
    flexDirection: 'row', 
    backgroundColor: 'white', 
    margin: 16, 
    borderRadius: 12,
    padding: 4,
  },
  tab: { 
    flex: 1, 
    paddingVertical: 12, 
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: { backgroundColor: '#667eea' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#666' },
  tabTextActive: { color: 'white' },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 12,
  },
  searchInput: { flex: 1, paddingVertical: 14, fontSize: 16, color: '#333' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: '#666', marginTop: 8, textAlign: 'center' },
  listContent: { padding: 16, paddingTop: 0 },
  clubCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  clubIcon: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clubIconText: { fontSize: 20, fontWeight: 'bold', color: 'white' },
  clubInfo: { flex: 1, marginLeft: 12 },
  clubName: { fontSize: 16, fontWeight: '600', color: '#333' },
  clubMeta: { fontSize: 12, color: '#666', marginTop: 4 },
  welcomeBonus: { fontSize: 11, color: '#10B981', marginTop: 4 },
  chipBalance: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chipIcon: { fontSize: 16 },
  chipAmount: { fontSize: 14, fontWeight: 'bold', color: '#667eea' },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
});
```

### Step 6.2: Create Club Detail Screen
Create `app/club/[id].tsx`:
```typescript
import { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useClubStore } from '../../store/clubStore';
import { useAuthStore } from '../../store/authStore';

type LobbyTab = 'tables' | 'members' | 'chat';

export default function ClubDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [activeTab, setActiveTab] = useState<LobbyTab>('tables');
  const [joining, setJoining] = useState(false);

  const {
    currentClub,
    currentMembership,
    currentMembers,
    currentTables,
    currentClubLoading,
    fetchClubDetails,
    fetchMembers,
    fetchTables,
    joinClub,
    leaveClub,
    clearCurrentClub,
  } = useClubStore();

  useEffect(() => {
    if (id) {
      fetchClubDetails(id);
      fetchMembers(id);
      fetchTables(id);
    }
    return () => clearCurrentClub();
  }, [id]);

  const handleJoin = async () => {
    if (!id) return;
    setJoining(true);
    try {
      await joinClub(id);
      Alert.alert('Success', 'You joined the club!');
    } catch (error: any) {
      if (error.response?.data?.details?.request_sent) {
        Alert.alert('Request Sent', 'Your join request has been sent to the club admins.');
      } else {
        Alert.alert('Error', error.response?.data?.error || 'Failed to join club');
      }
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = () => {
    Alert.alert(
      'Leave Club',
      'Are you sure you want to leave this club?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await leaveClub(id!);
              router.back();
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.error || 'Failed to leave club');
            }
          },
        },
      ]
    );
  };

  if (currentClubLoading || !currentClub) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

  const isMember = !!currentMembership;
  const isOwner = currentMembership?.role === 'owner';
  const isAdmin = currentMembership?.role === 'admin' || isOwner;

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: currentClub.name,
          headerRight: () => isMember && !isOwner ? (
            <TouchableOpacity onPress={handleLeave}>
              <Text style={styles.leaveButton}>Leave</Text>
            </TouchableOpacity>
          ) : null,
        }}
      />
      <View style={styles.container}>
        {/* Club Header */}
        <View style={styles.header}>
          <View style={styles.clubIcon}>
            <Text style={styles.clubIconText}>
              {currentClub.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.clubName}>{currentClub.name}</Text>
            <Text style={styles.clubStats}>
              {currentClub.member_count} members • {currentClub.privacy === 'private' ? '🔒 Private' : 'Public'}
            </Text>
            {currentClub.description && (
              <Text style={styles.description} numberOfLines={2}>
                {currentClub.description}
              </Text>
            )}
          </View>
        </View>

        {/* Member Chip Balance or Join Button */}
        {isMember ? (
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Your Chips</Text>
            <Text style={styles.balanceAmount}>
              🎰 {currentMembership.chip_balance.toLocaleString()}
            </Text>
            <Text style={styles.roleLabel}>{currentMembership.role.toUpperCase()}</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.joinButton, joining && styles.joinButtonDisabled]}
            onPress={handleJoin}
            disabled={joining}
          >
            {joining ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Ionicons name="enter-outline" size={20} color="white" />
                <Text style={styles.joinButtonText}>Join Club</Text>
                {currentClub.welcome_bonus > 0 && (
                  <Text style={styles.welcomeBonusText}>
                    +{currentClub.welcome_bonus.toLocaleString()} chips!
                  </Text>
                )}
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Lobby Tabs (only for members) */}
        {isMember && (
          <>
            <View style={styles.tabBar}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'tables' && styles.tabActive]}
                onPress={() => setActiveTab('tables')}
              >
                <Ionicons 
                  name="game-controller-outline" 
                  size={20} 
                  color={activeTab === 'tables' ? '#667eea' : '#666'} 
                />
                <Text style={[styles.tabText, activeTab === 'tables' && styles.tabTextActive]}>
                  Tables
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'members' && styles.tabActive]}
                onPress={() => setActiveTab('members')}
              >
                <Ionicons 
                  name="people-outline" 
                  size={20} 
                  color={activeTab === 'members' ? '#667eea' : '#666'} 
                />
                <Text style={[styles.tabText, activeTab === 'members' && styles.tabTextActive]}>
                  Members
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'chat' && styles.tabActive]}
                onPress={() => setActiveTab('chat')}
              >
                <Ionicons 
                  name="chatbubbles-outline" 
                  size={20} 
                  color={activeTab === 'chat' ? '#667eea' : '#666'} 
                />
                <Text style={[styles.tabText, activeTab === 'chat' && styles.tabTextActive]}>
                  Chat
                </Text>
              </TouchableOpacity>
            </View>

            {/* Tab Content */}
            <View style={styles.tabContent}>
              {activeTab === 'tables' && (
                currentTables.length === 0 ? (
                  <View style={styles.emptyTab}>
                    <Ionicons name="game-controller-outline" size={48} color="#ccc" />
                    <Text style={styles.emptyTabText}>No active tables</Text>
                    <Text style={styles.emptyTabSubtext}>Create a table to start playing!</Text>
                  </View>
                ) : (
                  <FlatList
                    data={currentTables}
                    keyExtractor={(item) => item.table_id}
                    renderItem={({ item }) => (
                      <View style={styles.tableCard}>
                        <View>
                          <Text style={styles.tableName}>Table by {item.creator_username}</Text>
                          <Text style={styles.tableStake}>🎰 {item.stake_amount} chips</Text>
                        </View>
                        <TouchableOpacity style={styles.joinTableButton}>
                          <Text style={styles.joinTableText}>Join</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  />
                )
              )}
              
              {activeTab === 'members' && (
                <FlatList
                  data={currentMembers}
                  keyExtractor={(item) => item.membership_id}
                  renderItem={({ item }) => (
                    <View style={styles.memberCard}>
                      <View style={styles.memberAvatar}>
                        <Text style={styles.memberAvatarText}>
                          {item.username?.charAt(0).toUpperCase() ?? '?'}
                        </Text>
                      </View>
                      <View style={styles.memberInfo}>
                        <Text style={styles.memberName}>{item.username}</Text>
                        <Text style={styles.memberRole}>{item.role}</Text>
                      </View>
                      <Text style={styles.memberChips}>
                        🎰 {item.chip_balance.toLocaleString()}
                      </Text>
                    </View>
                  )}
                />
              )}
              
              {activeTab === 'chat' && (
                <View style={styles.emptyTab}>
                  <Ionicons name="chatbubbles-outline" size={48} color="#ccc" />
                  <Text style={styles.emptyTabText}>Chat coming soon!</Text>
                  <Text style={styles.emptyTabSubtext}>Requires Lane 4 (WebSocket)</Text>
                </View>
              )}
            </View>
          </>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  leaveButton: { color: '#DC2626', fontSize: 16, marginRight: 16 },
  header: { flexDirection: 'row', padding: 16, backgroundColor: 'white' },
  clubIcon: { width: 70, height: 70, borderRadius: 16, backgroundColor: '#667eea', justifyContent: 'center', alignItems: 'center' },
  clubIconText: { fontSize: 28, fontWeight: 'bold', color: 'white' },
  headerInfo: { flex: 1, marginLeft: 16, justifyContent: 'center' },
  clubName: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  clubStats: { fontSize: 14, color: '#666', marginTop: 4 },
  description: { fontSize: 12, color: '#999', marginTop: 4 },
  balanceCard: { 
    backgroundColor: '#667eea', 
    margin: 16, 
    padding: 20, 
    borderRadius: 16, 
    alignItems: 'center' 
  },
  balanceLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  balanceAmount: { color: 'white', fontSize: 32, fontWeight: 'bold', marginTop: 4 },
  roleLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 12, marginTop: 8, fontWeight: '600' },
  joinButton: { 
    backgroundColor: '#10B981', 
    margin: 16, 
    padding: 18, 
    borderRadius: 12, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 8 
  },
  joinButtonDisabled: { opacity: 0.7 },
  joinButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  welcomeBonusText: { color: 'rgba(255,255,255,0.9)', fontSize: 12 },
  tabBar: { flexDirection: 'row', backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#eee' },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 6 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#667eea' },
  tabText: { fontSize: 14, color: '#666' },
  tabTextActive: { color: '#667eea', fontWeight: '600' },
  tabContent: { flex: 1 },
  emptyTab: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyTabText: { fontSize: 16, color: '#666', marginTop: 12 },
  emptyTabSubtext: { fontSize: 12, color: '#999', marginTop: 4 },
  tableCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'white', padding: 16, marginHorizontal: 16, marginTop: 12, borderRadius: 12 },
  tableName: { fontSize: 14, fontWeight: '600', color: '#333' },
  tableStake: { fontSize: 12, color: '#666', marginTop: 4 },
  joinTableButton: { backgroundColor: '#667eea', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  joinTableText: { color: 'white', fontWeight: '600' },
  memberCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', padding: 12, marginHorizontal: 16, marginTop: 8, borderRadius: 8 },
  memberAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#667eea', justifyContent: 'center', alignItems: 'center' },
  memberAvatarText: { color: 'white', fontWeight: 'bold' },
  memberInfo: { flex: 1, marginLeft: 12 },
  memberName: { fontSize: 14, fontWeight: '600', color: '#333' },
  memberRole: { fontSize: 11, color: '#666', marginTop: 2 },
  memberChips: { fontSize: 14, fontWeight: '600', color: '#667eea' },
});
```

---

## PHASE 7: Testing

### Step 7.1: Test Backend Endpoints
```bash
# Get all clubs
curl http://localhost:8000/v1/clubs

# Create club (requires 50,000 gold!)
curl -X POST http://localhost:8000/v1/clubs \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -d '{
    "name": "Test Club",
    "description": "A test club",
    "privacy": "public",
    "welcome_bonus": 1000
  }'

# Get user's clubs
curl http://localhost:8000/v1/clubs/user/my-clubs \
  -H 'Authorization: Bearer YOUR_TOKEN'

# Join a club
curl -X POST http://localhost:8000/v1/clubs/CLUB_ID/join \
  -H 'Authorization: Bearer YOUR_TOKEN'

# Get club members
curl http://localhost:8000/v1/clubs/CLUB_ID/members
```

### Step 7.2: Test Frontend
1. Navigate to Clubs tab
2. See "My Clubs" and "Discover" tabs
3. Search for clubs
4. Tap a club to see details
5. Join a public club
6. See your chip balance
7. View members list

---

## ✅ LANE 6 COMPLETION CHECKLIST

### Backend
- [ ] Club types defined
- [ ] Clubs repository complete (CRUD, memberships, chips, tables)
- [ ] Clubs service complete:
  - [ ] createClub() with gold deduction
  - [ ] joinClub() with welcome bonus
  - [ ] leaveClub()
  - [ ] grantChips()
  - [ ] Admin functions (promote, demote, kick)
  - [ ] Tables management
- [ ] Club validators defined
- [ ] Clubs controller complete
- [ ] Clubs routes configured
- [ ] Routes added to index

### Frontend
- [ ] Club types created
- [ ] Club API service created
- [ ] Club store with Zustand
- [ ] Clubs tab with My/Discover tabs
- [ ] Club detail/lobby screen
- [ ] Members list view
- [ ] Tables view (placeholder)
- [ ] Join/leave club works

**When all items are checked, LANE 6 IS COMPLETE!**

---

## 📁 FILES CREATED IN LANE 6

### Backend
```
src/
├── types/
│   └── club.types.ts
├── repositories/
│   └── clubs.repository.ts
├── services/
│   └── clubs.service.ts
├── validators/
│   └── club.validator.ts
├── controllers/
│   └── clubs.controller.ts
└── routes/
    └── clubs.routes.ts
```

### Frontend
```
types/
└── club.types.ts
services/api/
└── clubsApi.ts
store/
└── clubStore.ts
app/(tabs)/
└── clubs.tsx (updated)
app/club/
└── [id].tsx
```

---

## 🎉 ALL 6 LANES COMPLETE!

With Lane 6 done, you now have:
- ✅ **Lane 1**: Backend with auth, database, API
- ✅ **Lane 2**: Mobile app with navigation, auth screens
- ✅ **Lane 3**: Game engine and board rendering
- ✅ **Lane 4**: Real-time WebSocket for live updates
- ✅ **Lane 5**: Gold economy and shop
- ✅ **Lane 6**: Club system with chip economy

Your Backgammon Club MVP is ready! 🎲🎰
