import { Router } from 'express';
import { matchesController } from '../controllers/matches.controller';
import { authMiddleware, optionalAuth } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { z } from 'zod';

const router = Router();

const makeMoveSchema = z.object({
  moves: z.array(z.object({
    from: z.number().min(-1).max(23),
    to: z.number().min(-1).max(23),
    die_value: z.number().min(1).max(6),
  })).min(1),
});

// Get match (optional auth to check your_color)
router.get('/:matchId', optionalAuth, matchesController.getMatch.bind(matchesController));

// Protected routes
router.use(authMiddleware);

router.get('/user/history', matchesController.getHistory.bind(matchesController));
router.post('/:matchId/ready', matchesController.setReady.bind(matchesController));
router.post('/:matchId/roll', matchesController.rollDice.bind(matchesController));
router.post('/:matchId/move', validateRequest(makeMoveSchema), matchesController.makeMove.bind(matchesController));
router.post('/:matchId/forfeit', matchesController.forfeit.bind(matchesController));

export default router;
