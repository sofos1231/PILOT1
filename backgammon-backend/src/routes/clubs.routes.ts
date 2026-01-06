import { Router } from 'express';
import { clubsController } from '../controllers/clubs.controller';
import { authMiddleware, optionalAuth } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { createClubSchema, updateClubSchema, grantChipsSchema, createTableSchema } from '../validators/club.validator';

const router = Router();

// Public routes (with optional auth for membership info)
router.get('/', optionalAuth, clubsController.searchClubs.bind(clubsController));
router.get('/:clubId', optionalAuth, clubsController.getClub.bind(clubsController));
router.get('/:clubId/members', clubsController.getMembers.bind(clubsController));
router.get('/:clubId/leaderboard', clubsController.getLeaderboard.bind(clubsController));
router.get('/:clubId/tables', clubsController.getTables.bind(clubsController));

// Protected routes - require authentication
router.use(authMiddleware);

// User's clubs
router.get('/user/my-clubs', clubsController.getUserClubs.bind(clubsController));

// Club management
router.post('/', validateRequest(createClubSchema), clubsController.createClub.bind(clubsController));
router.patch('/:clubId', validateRequest(updateClubSchema), clubsController.updateClub.bind(clubsController));

// Membership
router.post('/:clubId/join', clubsController.joinClub.bind(clubsController));
router.post('/:clubId/leave', clubsController.leaveClub.bind(clubsController));

// Join requests (for private clubs)
router.get('/:clubId/requests', clubsController.getPendingRequests.bind(clubsController));
router.post('/:clubId/requests/:userId/approve', clubsController.approveRequest.bind(clubsController));
router.post('/:clubId/requests/:userId/reject', clubsController.rejectRequest.bind(clubsController));

// Chips
router.get('/:clubId/chips/balance', clubsController.getChipBalance.bind(clubsController));
router.post('/:clubId/chips/grant', validateRequest(grantChipsSchema), clubsController.grantChips.bind(clubsController));

// Admin functions
router.post('/:clubId/members/:userId/promote', clubsController.promoteToAdmin.bind(clubsController));
router.post('/:clubId/members/:userId/demote', clubsController.demoteFromAdmin.bind(clubsController));
router.post('/:clubId/members/:userId/kick', clubsController.kickMember.bind(clubsController));

// Tables
router.post('/:clubId/tables', validateRequest(createTableSchema), clubsController.createTable.bind(clubsController));
router.post('/tables/:tableId/cancel', clubsController.cancelTable.bind(clubsController));
router.post('/:clubId/tables/:tableId/join', clubsController.joinTable.bind(clubsController));

export default router;
