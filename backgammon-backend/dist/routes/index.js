"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_routes_1 = __importDefault(require("./auth.routes"));
const gold_routes_1 = __importDefault(require("./gold.routes"));
const matches_routes_1 = __importDefault(require("./matches.routes"));
const clubs_routes_1 = __importDefault(require("./clubs.routes"));
const matchmaking_routes_1 = __importDefault(require("./matchmaking.routes"));
const leaderboard_routes_1 = __importDefault(require("./leaderboard.routes"));
const router = (0, express_1.Router)();
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
router.use('/auth', auth_routes_1.default);
router.use('/gold', gold_routes_1.default);
router.use('/matches', matches_routes_1.default);
router.use('/clubs', clubs_routes_1.default);
router.use('/matchmaking', matchmaking_routes_1.default);
router.use('/leaderboard', leaderboard_routes_1.default);
exports.default = router;
