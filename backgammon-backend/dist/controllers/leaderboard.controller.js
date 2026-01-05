"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.leaderboardController = exports.LeaderboardController = void 0;
const leaderboard_service_1 = require("../services/leaderboard.service");
class LeaderboardController {
    async getGlobal(req, res, next) {
        try {
            const { sort_by, limit, offset } = req.query;
            const result = await leaderboard_service_1.leaderboardService.getGlobalLeaderboard({
                sort_by: sort_by,
                limit: limit ? parseInt(limit) : undefined,
                offset: offset ? parseInt(offset) : undefined,
            });
            res.status(200).json({ success: true, ...result });
        }
        catch (error) {
            next(error);
        }
    }
    async getUserRank(req, res, next) {
        try {
            const rank = await leaderboard_service_1.leaderboardService.getUserRank(req.user.userId);
            res.status(200).json({ success: true, rank });
        }
        catch (error) {
            next(error);
        }
    }
    async getAroundMe(req, res, next) {
        try {
            const range = req.query.range ? parseInt(req.query.range) : 5;
            const leaderboard = await leaderboard_service_1.leaderboardService.getLeaderboardAroundUser(req.user.userId, range);
            const myRank = await leaderboard_service_1.leaderboardService.getUserRank(req.user.userId);
            res.status(200).json({ success: true, leaderboard, my_rank: myRank });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.LeaderboardController = LeaderboardController;
exports.leaderboardController = new LeaderboardController();
