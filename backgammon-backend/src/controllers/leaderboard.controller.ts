import { Request, Response, NextFunction } from 'express';
import { leaderboardService } from '../services/leaderboard.service';

export class LeaderboardController {
  async getGlobal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sort_by, limit, offset } = req.query;
      const result = await leaderboardService.getGlobalLeaderboard({
        sort_by: sort_by as any,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async getUserRank(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rank = await leaderboardService.getUserRank(req.user!.userId);
      res.status(200).json({ success: true, rank });
    } catch (error) {
      next(error);
    }
  }

  async getAroundMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const range = req.query.range ? parseInt(req.query.range as string) : 5;
      const leaderboard = await leaderboardService.getLeaderboardAroundUser(req.user!.userId, range);
      const myRank = await leaderboardService.getUserRank(req.user!.userId);
      res.status(200).json({ success: true, leaderboard, my_rank: myRank });
    } catch (error) {
      next(error);
    }
  }
}

export const leaderboardController = new LeaderboardController();
