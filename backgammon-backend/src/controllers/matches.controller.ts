import { Request, Response, NextFunction } from 'express';
import { matchesService } from '../services/matches.service';

export class MatchesController {
  async getMatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const match = await matchesService.getMatch(req.params.matchId, req.user?.userId);
      res.status(200).json({ success: true, match });
    } catch (error) {
      next(error);
    }
  }

  async setReady(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await matchesService.setReady(req.params.matchId, req.user!.userId);
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async rollDice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await matchesService.rollDice(req.params.matchId, req.user!.userId);
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async makeMove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { moves } = req.body;
      const result = await matchesService.makeMove(req.params.matchId, req.user!.userId, moves);
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async forfeit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await matchesService.forfeit(req.params.matchId, req.user!.userId);
      res.status(200).json({ success: true, message: 'Match forfeited' });
    } catch (error) {
      next(error);
    }
  }

  async getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const matches = await matchesService.getMatchHistory(req.user!.userId, limit);
      res.status(200).json({ success: true, matches });
    } catch (error) {
      next(error);
    }
  }
}

export const matchesController = new MatchesController();
