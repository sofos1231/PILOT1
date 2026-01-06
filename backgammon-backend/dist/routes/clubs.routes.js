"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const clubs_controller_1 = require("../controllers/clubs.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const validation_middleware_1 = require("../middleware/validation.middleware");
const club_validator_1 = require("../validators/club.validator");
const router = (0, express_1.Router)();
// Public routes (with optional auth for membership info)
router.get('/', auth_middleware_1.optionalAuth, clubs_controller_1.clubsController.searchClubs.bind(clubs_controller_1.clubsController));
router.get('/:clubId', auth_middleware_1.optionalAuth, clubs_controller_1.clubsController.getClub.bind(clubs_controller_1.clubsController));
router.get('/:clubId/members', clubs_controller_1.clubsController.getMembers.bind(clubs_controller_1.clubsController));
router.get('/:clubId/leaderboard', clubs_controller_1.clubsController.getLeaderboard.bind(clubs_controller_1.clubsController));
router.get('/:clubId/tables', clubs_controller_1.clubsController.getTables.bind(clubs_controller_1.clubsController));
// Protected routes - require authentication
router.use(auth_middleware_1.authMiddleware);
// User's clubs
router.get('/user/my-clubs', clubs_controller_1.clubsController.getUserClubs.bind(clubs_controller_1.clubsController));
// Club management
router.post('/', (0, validation_middleware_1.validateRequest)(club_validator_1.createClubSchema), clubs_controller_1.clubsController.createClub.bind(clubs_controller_1.clubsController));
router.patch('/:clubId', (0, validation_middleware_1.validateRequest)(club_validator_1.updateClubSchema), clubs_controller_1.clubsController.updateClub.bind(clubs_controller_1.clubsController));
// Membership
router.post('/:clubId/join', clubs_controller_1.clubsController.joinClub.bind(clubs_controller_1.clubsController));
router.post('/:clubId/leave', clubs_controller_1.clubsController.leaveClub.bind(clubs_controller_1.clubsController));
// Join requests (for private clubs)
router.get('/:clubId/requests', clubs_controller_1.clubsController.getPendingRequests.bind(clubs_controller_1.clubsController));
router.post('/:clubId/requests/:userId/approve', clubs_controller_1.clubsController.approveRequest.bind(clubs_controller_1.clubsController));
router.post('/:clubId/requests/:userId/reject', clubs_controller_1.clubsController.rejectRequest.bind(clubs_controller_1.clubsController));
// Chips
router.get('/:clubId/chips/balance', clubs_controller_1.clubsController.getChipBalance.bind(clubs_controller_1.clubsController));
router.post('/:clubId/chips/grant', (0, validation_middleware_1.validateRequest)(club_validator_1.grantChipsSchema), clubs_controller_1.clubsController.grantChips.bind(clubs_controller_1.clubsController));
// Admin functions
router.post('/:clubId/members/:userId/promote', clubs_controller_1.clubsController.promoteToAdmin.bind(clubs_controller_1.clubsController));
router.post('/:clubId/members/:userId/demote', clubs_controller_1.clubsController.demoteFromAdmin.bind(clubs_controller_1.clubsController));
router.post('/:clubId/members/:userId/kick', clubs_controller_1.clubsController.kickMember.bind(clubs_controller_1.clubsController));
// Tables
router.post('/:clubId/tables', (0, validation_middleware_1.validateRequest)(club_validator_1.createTableSchema), clubs_controller_1.clubsController.createTable.bind(clubs_controller_1.clubsController));
router.post('/tables/:tableId/cancel', clubs_controller_1.clubsController.cancelTable.bind(clubs_controller_1.clubsController));
router.post('/:clubId/tables/:tableId/join', clubs_controller_1.clubsController.joinTable.bind(clubs_controller_1.clubsController));
exports.default = router;
