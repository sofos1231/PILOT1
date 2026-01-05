"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchesController = exports.MatchesController = void 0;
const matches_service_1 = require("../services/matches.service");
class MatchesController {
    async getMatch(req, res, next) {
        try {
            const match = await matches_service_1.matchesService.getMatch(req.params.matchId, req.user?.userId);
            res.status(200).json({ success: true, match });
        }
        catch (error) {
            next(error);
        }
    }
    async setReady(req, res, next) {
        try {
            const result = await matches_service_1.matchesService.setReady(req.params.matchId, req.user.userId);
            res.status(200).json({ success: true, ...result });
        }
        catch (error) {
            next(error);
        }
    }
    async rollDice(req, res, next) {
        try {
            const result = await matches_service_1.matchesService.rollDice(req.params.matchId, req.user.userId);
            res.status(200).json({ success: true, ...result });
        }
        catch (error) {
            next(error);
        }
    }
    async makeMove(req, res, next) {
        try {
            const { moves } = req.body;
            const result = await matches_service_1.matchesService.makeMove(req.params.matchId, req.user.userId, moves);
            res.status(200).json({ success: true, ...result });
        }
        catch (error) {
            next(error);
        }
    }
    async forfeit(req, res, next) {
        try {
            await matches_service_1.matchesService.forfeit(req.params.matchId, req.user.userId);
            res.status(200).json({ success: true, message: 'Match forfeited' });
        }
        catch (error) {
            next(error);
        }
    }
    async getHistory(req, res, next) {
        try {
            const limit = req.query.limit ? parseInt(req.query.limit) : 20;
            const matches = await matches_service_1.matchesService.getMatchHistory(req.user.userId, limit);
            res.status(200).json({ success: true, matches });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.MatchesController = MatchesController;
exports.matchesController = new MatchesController();
