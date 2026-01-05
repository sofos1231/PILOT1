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
