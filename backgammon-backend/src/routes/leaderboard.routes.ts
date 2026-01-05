import { Router } from 'express';
import { leaderboardController } from '../controllers/leaderboard.controller';
import { authMiddleware, optionalAuth } from '../middleware/auth.middleware';

const router = Router();

router.get('/', optionalAuth, leaderboardController.getGlobal.bind(leaderboardController));
router.get('/me', authMiddleware, leaderboardController.getUserRank.bind(leaderboardController));
router.get('/around-me', authMiddleware, leaderboardController.getAroundMe.bind(leaderboardController));

export default router;
