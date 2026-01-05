"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const matches_controller_1 = require("../controllers/matches.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const validation_middleware_1 = require("../middleware/validation.middleware");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
const makeMoveSchema = zod_1.z.object({
    moves: zod_1.z.array(zod_1.z.object({
        from: zod_1.z.number().min(-1).max(23),
        to: zod_1.z.number().min(-1).max(23),
        die_value: zod_1.z.number().min(1).max(6),
    })).min(1),
});
// Get match (optional auth to check your_color)
router.get('/:matchId', auth_middleware_1.optionalAuth, matches_controller_1.matchesController.getMatch.bind(matches_controller_1.matchesController));
// Protected routes
router.use(auth_middleware_1.authMiddleware);
router.get('/user/history', matches_controller_1.matchesController.getHistory.bind(matches_controller_1.matchesController));
router.post('/:matchId/ready', matches_controller_1.matchesController.setReady.bind(matches_controller_1.matchesController));
router.post('/:matchId/roll', matches_controller_1.matchesController.rollDice.bind(matches_controller_1.matchesController));
router.post('/:matchId/move', (0, validation_middleware_1.validateRequest)(makeMoveSchema), matches_controller_1.matchesController.makeMove.bind(matches_controller_1.matchesController));
router.post('/:matchId/forfeit', matches_controller_1.matchesController.forfeit.bind(matches_controller_1.matchesController));
exports.default = router;
