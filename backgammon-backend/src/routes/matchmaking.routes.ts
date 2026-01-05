import { Router } from 'express';
import { matchmakingController } from '../controllers/matchmaking.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { z } from 'zod';

const router = Router();

const joinQueueSchema = z.object({
  stake_amount: z.number().positive().max(1000000),
  match_type: z.enum(['gold', 'club']).optional(),
  club_id: z.string().uuid().optional(),
});

router.use(authMiddleware);

router.post('/join', validateRequest(joinQueueSchema), matchmakingController.joinQueue.bind(matchmakingController));
router.post('/leave', matchmakingController.leaveQueue.bind(matchmakingController));
router.get('/status', matchmakingController.getStatus.bind(matchmakingController));

export default router;
