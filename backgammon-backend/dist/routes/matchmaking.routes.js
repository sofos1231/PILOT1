"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const matchmaking_controller_1 = require("../controllers/matchmaking.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const validation_middleware_1 = require("../middleware/validation.middleware");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
const joinQueueSchema = zod_1.z.object({
    stake_amount: zod_1.z.number().positive().max(1000000),
    match_type: zod_1.z.enum(['gold', 'club']).optional(),
    club_id: zod_1.z.string().uuid().optional(),
});
router.use(auth_middleware_1.authMiddleware);
router.post('/join', (0, validation_middleware_1.validateRequest)(joinQueueSchema), matchmaking_controller_1.matchmakingController.joinQueue.bind(matchmaking_controller_1.matchmakingController));
router.post('/leave', matchmaking_controller_1.matchmakingController.leaveQueue.bind(matchmaking_controller_1.matchmakingController));
router.get('/status', matchmaking_controller_1.matchmakingController.getStatus.bind(matchmaking_controller_1.matchmakingController));
exports.default = router;
