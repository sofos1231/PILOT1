"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clubsController = exports.ClubsController = void 0;
const clubs_service_1 = require("../services/clubs.service");
class ClubsController {
    // ===== CLUBS =====
    async createClub(req, res, next) {
        try {
            const club = await clubs_service_1.clubsService.createClub(req.user.userId, req.body);
            res.status(201).json({ success: true, club });
        }
        catch (error) {
            next(error);
        }
    }
    async getClub(req, res, next) {
        try {
            const club = await clubs_service_1.clubsService.getClub(req.params.clubId);
            // Get user's membership if authenticated
            let membership = null;
            if (req.user) {
                membership = await clubs_service_1.clubsService.getMembership(req.params.clubId, req.user.userId);
            }
            res.status(200).json({ success: true, club, membership });
        }
        catch (error) {
            next(error);
        }
    }
    async searchClubs(req, res, next) {
        try {
            const { search, privacy, limit, offset } = req.query;
            const result = await clubs_service_1.clubsService.searchClubs({
                search: search,
                privacy: privacy,
                limit: limit ? parseInt(limit) : undefined,
                offset: offset ? parseInt(offset) : undefined,
            });
            res.status(200).json({ success: true, ...result });
        }
        catch (error) {
            next(error);
        }
    }
    async updateClub(req, res, next) {
        try {
            const club = await clubs_service_1.clubsService.updateClub(req.user.userId, req.params.clubId, req.body);
            res.status(200).json({ success: true, club });
        }
        catch (error) {
            next(error);
        }
    }
    async getUserClubs(req, res, next) {
        try {
            const result = await clubs_service_1.clubsService.getUserClubs(req.user.userId);
            res.status(200).json({ success: true, ...result });
        }
        catch (error) {
            next(error);
        }
    }
    // ===== MEMBERSHIP =====
    async joinClub(req, res, next) {
        try {
            const membership = await clubs_service_1.clubsService.joinClub(req.user.userId, req.params.clubId);
            res.status(201).json({ success: true, membership });
        }
        catch (error) {
            next(error);
        }
    }
    async leaveClub(req, res, next) {
        try {
            await clubs_service_1.clubsService.leaveClub(req.user.userId, req.params.clubId);
            res.status(200).json({ success: true, message: 'Left club successfully' });
        }
        catch (error) {
            next(error);
        }
    }
    async getMembers(req, res, next) {
        try {
            const { search, sort, limit, offset } = req.query;
            const result = await clubs_service_1.clubsService.getMembers(req.params.clubId, {
                search: search,
                sort: sort,
                limit: limit ? parseInt(limit) : undefined,
                offset: offset ? parseInt(offset) : undefined,
            });
            res.status(200).json({ success: true, ...result });
        }
        catch (error) {
            next(error);
        }
    }
    // ===== JOIN REQUESTS =====
    async getPendingRequests(req, res, next) {
        try {
            const result = await clubs_service_1.clubsService.getPendingRequests(req.user.userId, req.params.clubId);
            res.status(200).json({ success: true, ...result });
        }
        catch (error) {
            next(error);
        }
    }
    async approveRequest(req, res, next) {
        try {
            const membership = await clubs_service_1.clubsService.approveRequest(req.user.userId, req.params.clubId, req.params.userId);
            res.status(200).json({ success: true, membership });
        }
        catch (error) {
            next(error);
        }
    }
    async rejectRequest(req, res, next) {
        try {
            await clubs_service_1.clubsService.rejectRequest(req.user.userId, req.params.clubId, req.params.userId);
            res.status(200).json({ success: true, message: 'Request rejected' });
        }
        catch (error) {
            next(error);
        }
    }
    // ===== CHIPS =====
    async grantChips(req, res, next) {
        try {
            const { user_id, amount, reason } = req.body;
            const result = await clubs_service_1.clubsService.grantChips(req.user.userId, req.params.clubId, user_id, amount, reason);
            res.status(200).json({ success: true, ...result });
        }
        catch (error) {
            next(error);
        }
    }
    async getChipBalance(req, res, next) {
        try {
            const result = await clubs_service_1.clubsService.getChipBalance(req.user.userId, req.params.clubId);
            res.status(200).json({ success: true, ...result });
        }
        catch (error) {
            next(error);
        }
    }
    // ===== ADMIN =====
    async promoteToAdmin(req, res, next) {
        try {
            await clubs_service_1.clubsService.promoteToAdmin(req.user.userId, req.params.clubId, req.params.userId);
            res.status(200).json({ success: true, message: 'User promoted to admin' });
        }
        catch (error) {
            next(error);
        }
    }
    async demoteFromAdmin(req, res, next) {
        try {
            await clubs_service_1.clubsService.demoteFromAdmin(req.user.userId, req.params.clubId, req.params.userId);
            res.status(200).json({ success: true, message: 'User demoted to member' });
        }
        catch (error) {
            next(error);
        }
    }
    async kickMember(req, res, next) {
        try {
            await clubs_service_1.clubsService.kickMember(req.user.userId, req.params.clubId, req.params.userId);
            res.status(200).json({ success: true, message: 'Member kicked' });
        }
        catch (error) {
            next(error);
        }
    }
    // ===== TABLES =====
    async createTable(req, res, next) {
        try {
            const table = await clubs_service_1.clubsService.createTable(req.user.userId, req.params.clubId, req.body.stake_amount);
            res.status(201).json({ success: true, table });
        }
        catch (error) {
            next(error);
        }
    }
    async getTables(req, res, next) {
        try {
            const result = await clubs_service_1.clubsService.getTables(req.params.clubId);
            res.status(200).json({ success: true, ...result });
        }
        catch (error) {
            next(error);
        }
    }
    async cancelTable(req, res, next) {
        try {
            await clubs_service_1.clubsService.cancelTable(req.user.userId, req.params.tableId);
            res.status(200).json({ success: true, message: 'Table cancelled' });
        }
        catch (error) {
            next(error);
        }
    }
    // ===== LEADERBOARD =====
    async getLeaderboard(req, res, next) {
        try {
            const limit = req.query.limit ? parseInt(req.query.limit) : 10;
            const result = await clubs_service_1.clubsService.getLeaderboard(req.params.clubId, limit);
            res.status(200).json({ success: true, ...result });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.ClubsController = ClubsController;
exports.clubsController = new ClubsController();
