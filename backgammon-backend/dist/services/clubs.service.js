"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clubsService = exports.ClubsService = void 0;
const connection_1 = __importDefault(require("../db/connection"));
const clubs_repository_1 = require("../repositories/clubs.repository");
const users_repository_1 = require("../repositories/users.repository");
const gold_repository_1 = require("../repositories/gold.repository");
const AppError_1 = require("../errors/AppError");
// Configuration
const CLUB_CREATION_COST = 50000; // Gold required to create a club
const MAX_CHIP_GRANT_AMOUNT = 10000; // Maximum chips per grant
class ClubsService {
    // ===== CLUB CRUD =====
    async createClub(userId, data) {
        // Check gold balance
        const user = await users_repository_1.usersRepository.findById(userId);
        if (!user) {
            throw new AppError_1.NotFoundError('User');
        }
        if (user.gold_balance < CLUB_CREATION_COST) {
            throw new AppError_1.ValidationError(`Requires ${CLUB_CREATION_COST.toLocaleString()} gold to create a club. You have ${user.gold_balance.toLocaleString()}.`);
        }
        // Validate name
        if (!data.name || data.name.trim().length < 3) {
            throw new AppError_1.ValidationError('Club name must be at least 3 characters');
        }
        if (data.name.trim().length > 50) {
            throw new AppError_1.ValidationError('Club name must be at most 50 characters');
        }
        // Check name uniqueness
        const existing = await clubs_repository_1.clubsRepository.findByName(data.name);
        if (existing) {
            throw new AppError_1.ValidationError('Club name already exists');
        }
        // Validate welcome bonus
        if (data.welcome_bonus !== undefined) {
            if (data.welcome_bonus < 0 || data.welcome_bonus > 100000) {
                throw new AppError_1.ValidationError('Welcome bonus must be between 0 and 100,000');
            }
        }
        // Start transaction
        const client = await connection_1.default.connect();
        try {
            await client.query('BEGIN');
            // Deduct gold
            const newGoldBalance = user.gold_balance - CLUB_CREATION_COST;
            await client.query('UPDATE users SET gold_balance = $1, total_gold_spent = total_gold_spent + $2 WHERE user_id = $3', [newGoldBalance, CLUB_CREATION_COST, userId]);
            // Record gold transaction
            await gold_repository_1.goldRepository.createTransaction({
                user_id: userId,
                type: 'club_creation',
                amount: -CLUB_CREATION_COST,
                balance_after: newGoldBalance,
                description: `Created club: ${data.name}`,
            });
            // Create club
            const club = await clubs_repository_1.clubsRepository.create({
                ...data,
                owner_id: userId,
            });
            // Add owner as first member with welcome bonus
            const welcomeBonus = data.welcome_bonus || 0;
            await clubs_repository_1.clubsRepository.createMembership({
                club_id: club.club_id,
                user_id: userId,
                role: 'owner',
                chip_balance: welcomeBonus,
            });
            // Record chip transaction if welcome bonus > 0
            if (welcomeBonus > 0) {
                await clubs_repository_1.clubsRepository.createChipTransaction({
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
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    async getClub(clubId) {
        const club = await clubs_repository_1.clubsRepository.findById(clubId);
        if (!club) {
            throw new AppError_1.NotFoundError('Club');
        }
        return club;
    }
    async searchClubs(options) {
        return clubs_repository_1.clubsRepository.search(options);
    }
    async updateClub(userId, clubId, data) {
        const club = await this.getClub(clubId);
        const membership = await clubs_repository_1.clubsRepository.getMembership(clubId, userId);
        if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
            throw new AppError_1.ForbiddenError('Only owner or admin can update club');
        }
        // Only owner can change certain settings
        if (membership.role !== 'owner') {
            if (data.privacy !== undefined || data.welcome_bonus !== undefined) {
                throw new AppError_1.ForbiddenError('Only owner can change privacy and welcome bonus');
            }
        }
        // Validate name if changing
        if (data.name && data.name !== club.name) {
            const existing = await clubs_repository_1.clubsRepository.findByName(data.name);
            if (existing) {
                throw new AppError_1.ValidationError('Club name already exists');
            }
        }
        return clubs_repository_1.clubsRepository.update(clubId, data);
    }
    // ===== MEMBERSHIP =====
    async joinClub(userId, clubId) {
        const club = await this.getClub(clubId);
        // Check if already a member
        const existing = await clubs_repository_1.clubsRepository.getMembership(clubId, userId);
        if (existing) {
            throw new AppError_1.ValidationError('Already a member of this club');
        }
        // Handle private clubs
        if (club.privacy === 'private') {
            // Check for existing request
            const existingRequest = await clubs_repository_1.clubsRepository.getJoinRequest(clubId, userId);
            if (existingRequest?.status === 'pending') {
                throw new AppError_1.ValidationError('Join request already pending');
            }
            // Create join request
            await clubs_repository_1.clubsRepository.createJoinRequest(clubId, userId);
            throw new AppError_1.ValidationError('Join request sent. Waiting for approval.', { request_sent: true });
        }
        // Public club - join directly
        const membership = await clubs_repository_1.clubsRepository.createMembership({
            club_id: clubId,
            user_id: userId,
            role: 'member',
            chip_balance: club.welcome_bonus,
        });
        await clubs_repository_1.clubsRepository.incrementMemberCount(clubId);
        // Record welcome bonus transaction
        if (club.welcome_bonus > 0) {
            await clubs_repository_1.clubsRepository.createChipTransaction({
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
    async leaveClub(userId, clubId) {
        const membership = await clubs_repository_1.clubsRepository.getMembership(clubId, userId);
        if (!membership) {
            throw new AppError_1.ValidationError('Not a member of this club');
        }
        if (membership.role === 'owner') {
            throw new AppError_1.ValidationError('Owner cannot leave club. Transfer ownership first or delete the club.');
        }
        await clubs_repository_1.clubsRepository.removeMember(clubId, userId);
        await clubs_repository_1.clubsRepository.decrementMemberCount(clubId);
    }
    async getMembers(clubId, options) {
        await this.getClub(clubId); // Verify club exists
        return clubs_repository_1.clubsRepository.getMembers(clubId, options);
    }
    async getUserClubs(userId) {
        const clubs = await clubs_repository_1.clubsRepository.getUserClubs(userId);
        return { clubs };
    }
    async getMembership(clubId, userId) {
        return clubs_repository_1.clubsRepository.getMembership(clubId, userId);
    }
    // ===== JOIN REQUESTS =====
    async getPendingRequests(userId, clubId) {
        const membership = await clubs_repository_1.clubsRepository.getMembership(clubId, userId);
        if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
            throw new AppError_1.ForbiddenError('Only owner or admin can view requests');
        }
        const requests = await clubs_repository_1.clubsRepository.getPendingRequests(clubId);
        return { requests };
    }
    async approveRequest(adminUserId, clubId, requestUserId) {
        const membership = await clubs_repository_1.clubsRepository.getMembership(clubId, adminUserId);
        if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
            throw new AppError_1.ForbiddenError('Only owner or admin can approve requests');
        }
        const request = await clubs_repository_1.clubsRepository.getJoinRequest(clubId, requestUserId);
        if (!request || request.status !== 'pending') {
            throw new AppError_1.ValidationError('No pending request found');
        }
        const club = await this.getClub(clubId);
        // Create membership
        const newMembership = await clubs_repository_1.clubsRepository.createMembership({
            club_id: clubId,
            user_id: requestUserId,
            role: 'member',
            chip_balance: club.welcome_bonus,
        });
        await clubs_repository_1.clubsRepository.updateJoinRequestStatus(request.request_id, 'approved');
        await clubs_repository_1.clubsRepository.incrementMemberCount(clubId);
        // Record welcome bonus
        if (club.welcome_bonus > 0) {
            await clubs_repository_1.clubsRepository.createChipTransaction({
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
    async rejectRequest(adminUserId, clubId, requestUserId) {
        const membership = await clubs_repository_1.clubsRepository.getMembership(clubId, adminUserId);
        if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
            throw new AppError_1.ForbiddenError('Only owner or admin can reject requests');
        }
        const request = await clubs_repository_1.clubsRepository.getJoinRequest(clubId, requestUserId);
        if (!request || request.status !== 'pending') {
            throw new AppError_1.ValidationError('No pending request found');
        }
        await clubs_repository_1.clubsRepository.updateJoinRequestStatus(request.request_id, 'rejected');
    }
    // ===== CHIP MANAGEMENT =====
    async grantChips(granterId, clubId, recipientId, amount, reason) {
        if (amount <= 0) {
            throw new AppError_1.ValidationError('Amount must be positive');
        }
        if (amount > MAX_CHIP_GRANT_AMOUNT) {
            throw new AppError_1.ValidationError(`Maximum grant amount is ${MAX_CHIP_GRANT_AMOUNT.toLocaleString()} chips`);
        }
        const granterMembership = await clubs_repository_1.clubsRepository.getMembership(clubId, granterId);
        if (!granterMembership || (granterMembership.role !== 'owner' && granterMembership.role !== 'admin')) {
            throw new AppError_1.ForbiddenError('Only owner or admin can grant chips');
        }
        const recipientMembership = await clubs_repository_1.clubsRepository.getMembership(clubId, recipientId);
        if (!recipientMembership) {
            throw new AppError_1.ValidationError('Recipient is not a member of this club');
        }
        const newBalance = await clubs_repository_1.clubsRepository.updateMemberChips(clubId, recipientId, amount);
        await clubs_repository_1.clubsRepository.createChipTransaction({
            club_id: clubId,
            type: 'grant',
            from_user_id: granterId,
            to_user_id: recipientId,
            amount: amount,
            balance_after: newBalance,
            reason: reason || 'Chip grant from admin',
        });
        // Update club's total chips in circulation
        await connection_1.default.query('UPDATE clubs SET total_chips_in_circulation = total_chips_in_circulation + $1 WHERE club_id = $2', [amount, clubId]);
        return { new_balance: newBalance };
    }
    async getChipBalance(userId, clubId) {
        const membership = await clubs_repository_1.clubsRepository.getMembership(clubId, userId);
        if (!membership) {
            throw new AppError_1.ValidationError('Not a member of this club');
        }
        return { balance: membership.chip_balance };
    }
    // ===== ADMIN FUNCTIONS =====
    async promoteToAdmin(ownerId, clubId, targetUserId) {
        const ownerMembership = await clubs_repository_1.clubsRepository.getMembership(clubId, ownerId);
        if (!ownerMembership || ownerMembership.role !== 'owner') {
            throw new AppError_1.ForbiddenError('Only owner can promote members');
        }
        const targetMembership = await clubs_repository_1.clubsRepository.getMembership(clubId, targetUserId);
        if (!targetMembership) {
            throw new AppError_1.ValidationError('User is not a member');
        }
        if (targetMembership.role === 'owner') {
            throw new AppError_1.ValidationError('Cannot change owner role');
        }
        await clubs_repository_1.clubsRepository.updateMemberRole(clubId, targetUserId, 'admin');
    }
    async demoteFromAdmin(ownerId, clubId, targetUserId) {
        const ownerMembership = await clubs_repository_1.clubsRepository.getMembership(clubId, ownerId);
        if (!ownerMembership || ownerMembership.role !== 'owner') {
            throw new AppError_1.ForbiddenError('Only owner can demote admins');
        }
        const targetMembership = await clubs_repository_1.clubsRepository.getMembership(clubId, targetUserId);
        if (!targetMembership || targetMembership.role !== 'admin') {
            throw new AppError_1.ValidationError('User is not an admin');
        }
        await clubs_repository_1.clubsRepository.updateMemberRole(clubId, targetUserId, 'member');
    }
    async kickMember(adminId, clubId, targetUserId) {
        const adminMembership = await clubs_repository_1.clubsRepository.getMembership(clubId, adminId);
        if (!adminMembership || (adminMembership.role !== 'owner' && adminMembership.role !== 'admin')) {
            throw new AppError_1.ForbiddenError('Only owner or admin can kick members');
        }
        const targetMembership = await clubs_repository_1.clubsRepository.getMembership(clubId, targetUserId);
        if (!targetMembership) {
            throw new AppError_1.ValidationError('User is not a member');
        }
        // Admins can't kick other admins or owner
        if (adminMembership.role === 'admin' && targetMembership.role !== 'member') {
            throw new AppError_1.ForbiddenError('Admins can only kick regular members');
        }
        // Owner can't be kicked
        if (targetMembership.role === 'owner') {
            throw new AppError_1.ForbiddenError('Cannot kick club owner');
        }
        await clubs_repository_1.clubsRepository.removeMember(clubId, targetUserId);
        await clubs_repository_1.clubsRepository.decrementMemberCount(clubId);
    }
    // ===== TABLES =====
    async createTable(userId, clubId, stakeAmount) {
        const membership = await clubs_repository_1.clubsRepository.getMembership(clubId, userId);
        if (!membership) {
            throw new AppError_1.ValidationError('Not a member of this club');
        }
        if (stakeAmount <= 0) {
            throw new AppError_1.ValidationError('Stake amount must be positive');
        }
        if (membership.chip_balance < stakeAmount) {
            throw new AppError_1.ValidationError(`Insufficient chips. You have ${membership.chip_balance}, need ${stakeAmount}`);
        }
        return clubs_repository_1.clubsRepository.createTable({
            club_id: clubId,
            creator_user_id: userId,
            stake_amount: stakeAmount,
        });
    }
    async getTables(clubId) {
        await this.getClub(clubId);
        const tables = await clubs_repository_1.clubsRepository.getTables(clubId);
        return { tables };
    }
    async cancelTable(userId, tableId) {
        const table = await clubs_repository_1.clubsRepository.getTable(tableId);
        if (!table) {
            throw new AppError_1.NotFoundError('Table');
        }
        if (table.creator_user_id !== userId) {
            const membership = await clubs_repository_1.clubsRepository.getMembership(table.club_id, userId);
            if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
                throw new AppError_1.ForbiddenError('Only table creator or admin can cancel');
            }
        }
        if (table.status !== 'waiting') {
            throw new AppError_1.ValidationError('Can only cancel waiting tables');
        }
        await clubs_repository_1.clubsRepository.cancelTable(tableId);
    }
    // ===== LEADERBOARD =====
    async getLeaderboard(clubId, limit = 10) {
        await this.getClub(clubId);
        const { members } = await clubs_repository_1.clubsRepository.getMembers(clubId, {
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
exports.ClubsService = ClubsService;
exports.clubsService = new ClubsService();
