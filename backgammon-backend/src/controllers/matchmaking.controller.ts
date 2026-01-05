import { Request, Response, NextFunction } from 'express';
import { matchmakingService } from '../services/matchmaking.service';

export class MatchmakingController {
  async joinQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { stake_amount, match_type, club_id } = req.body;
      const result = await matchmakingService.joinQueue(
        req.user!.userId,
        stake_amount,
        match_type,
        club_id
      );
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async leaveQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cancelled = await matchmakingService.leaveQueue(req.user!.userId);
      res.status(200).json({ success: true, cancelled });
    } catch (error) {
      next(error);
    }
  }

  async getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = await matchmakingService.getQueueStatus(req.user!.userId);
      res.status(200).json({ success: true, ...status });
    } catch (error) {
      next(error);
    }
  }
}

export const matchmakingController = new MatchmakingController();
