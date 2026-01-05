import { Router } from 'express';
import authRoutes from './auth.routes';
import goldRoutes from './gold.routes';
import matchesRoutes from './matches.routes';
import clubsRoutes from './clubs.routes';
import matchmakingRoutes from './matchmaking.routes';
import leaderboardRoutes from './leaderboard.routes';

const router = Router();

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
router.use('/auth', authRoutes);
router.use('/gold', goldRoutes);
router.use('/matches', matchesRoutes);
router.use('/clubs', clubsRoutes);
router.use('/matchmaking', matchmakingRoutes);
router.use('/leaderboard', leaderboardRoutes);

export default router;
