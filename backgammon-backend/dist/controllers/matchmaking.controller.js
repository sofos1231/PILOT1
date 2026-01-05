"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchmakingController = exports.MatchmakingController = void 0;
const matchmaking_service_1 = require("../services/matchmaking.service");
class MatchmakingController {
    async joinQueue(req, res, next) {
        try {
            const { stake_amount, match_type, club_id } = req.body;
            const result = await matchmaking_service_1.matchmakingService.joinQueue(req.user.userId, stake_amount, match_type, club_id);
            res.status(200).json({ success: true, ...result });
        }
        catch (error) {
            next(error);
        }
    }
    async leaveQueue(req, res, next) {
        try {
            const cancelled = await matchmaking_service_1.matchmakingService.leaveQueue(req.user.userId);
            res.status(200).json({ success: true, cancelled });
        }
        catch (error) {
            next(error);
        }
    }
    async getStatus(req, res, next) {
        try {
            const status = await matchmaking_service_1.matchmakingService.getQueueStatus(req.user.userId);
            res.status(200).json({ success: true, ...status });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.MatchmakingController = MatchmakingController;
exports.matchmakingController = new MatchmakingController();
