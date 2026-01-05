import { Request, Response, NextFunction } from 'express';
import { clubsService } from '../services/clubs.service';

export class ClubsController {
  // ===== CLUBS =====

  async createClub(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const club = await clubsService.createClub(req.user!.userId, req.body);
      res.status(201).json({ success: true, club });
    } catch (error) {
      next(error);
    }
  }

  async getClub(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const club = await clubsService.getClub(req.params.clubId);

      // Get user's membership if authenticated
      let membership = null;
      if (req.user) {
        membership = await clubsService.getMembership(req.params.clubId, req.user.userId);
      }

      res.status(200).json({ success: true, club, membership });
    } catch (error) {
      next(error);
    }
  }

  async searchClubs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { search, privacy, limit, offset } = req.query;
      const result = await clubsService.searchClubs({
        search: search as string,
        privacy: privacy as string,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async updateClub(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const club = await clubsService.updateClub(req.user!.userId, req.params.clubId, req.body);
      res.status(200).json({ success: true, club });
    } catch (error) {
      next(error);
    }
  }

  async getUserClubs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await clubsService.getUserClubs(req.user!.userId);
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  // ===== MEMBERSHIP =====

  async joinClub(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const membership = await clubsService.joinClub(req.user!.userId, req.params.clubId);
      res.status(201).json({ success: true, membership });
    } catch (error) {
      next(error);
    }
  }

  async leaveClub(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await clubsService.leaveClub(req.user!.userId, req.params.clubId);
      res.status(200).json({ success: true, message: 'Left club successfully' });
    } catch (error) {
      next(error);
    }
  }

  async getMembers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { search, sort, limit, offset } = req.query;
      const result = await clubsService.getMembers(req.params.clubId, {
        search: search as string,
        sort: sort as 'chips' | 'name' | 'joined',
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  // ===== JOIN REQUESTS =====

  async getPendingRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await clubsService.getPendingRequests(req.user!.userId, req.params.clubId);
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async approveRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const membership = await clubsService.approveRequest(
        req.user!.userId,
        req.params.clubId,
        req.params.userId
      );
      res.status(200).json({ success: true, membership });
    } catch (error) {
      next(error);
    }
  }

  async rejectRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await clubsService.rejectRequest(
        req.user!.userId,
        req.params.clubId,
        req.params.userId
      );
      res.status(200).json({ success: true, message: 'Request rejected' });
    } catch (error) {
      next(error);
    }
  }

  // ===== CHIPS =====

  async grantChips(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { user_id, amount, reason } = req.body;
      const result = await clubsService.grantChips(
        req.user!.userId,
        req.params.clubId,
        user_id,
        amount,
        reason
      );
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async getChipBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await clubsService.getChipBalance(req.user!.userId, req.params.clubId);
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  // ===== ADMIN =====

  async promoteToAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await clubsService.promoteToAdmin(req.user!.userId, req.params.clubId, req.params.userId);
      res.status(200).json({ success: true, message: 'User promoted to admin' });
    } catch (error) {
      next(error);
    }
  }

  async demoteFromAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await clubsService.demoteFromAdmin(req.user!.userId, req.params.clubId, req.params.userId);
      res.status(200).json({ success: true, message: 'User demoted to member' });
    } catch (error) {
      next(error);
    }
  }

  async kickMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await clubsService.kickMember(req.user!.userId, req.params.clubId, req.params.userId);
      res.status(200).json({ success: true, message: 'Member kicked' });
    } catch (error) {
      next(error);
    }
  }

  // ===== TABLES =====

  async createTable(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const table = await clubsService.createTable(
        req.user!.userId,
        req.params.clubId,
        req.body.stake_amount
      );
      res.status(201).json({ success: true, table });
    } catch (error) {
      next(error);
    }
  }

  async getTables(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await clubsService.getTables(req.params.clubId);
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async cancelTable(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await clubsService.cancelTable(req.user!.userId, req.params.tableId);
      res.status(200).json({ success: true, message: 'Table cancelled' });
    } catch (error) {
      next(error);
    }
  }

  // ===== LEADERBOARD =====

  async getLeaderboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const result = await clubsService.getLeaderboard(req.params.clubId, limit);
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }
}

export const clubsController = new ClubsController();
