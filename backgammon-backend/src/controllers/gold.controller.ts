import { Request, Response, NextFunction } from 'express';
import { goldService } from '../services/gold.service';
import { getPackage, getTotalGold } from '../config/packages';

export class GoldController {
  async getBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await goldService.getBalance(req.user!.userId);
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async getPackages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = goldService.getPackages();
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async createPurchaseIntent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { package_id } = req.body;
      const result = await goldService.createPurchaseIntent(req.user!.userId, package_id);
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async confirmPurchase(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { payment_intent_id } = req.body;
      const result = await goldService.confirmPurchase(payment_intent_id);
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async getTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { limit, offset, type } = req.query;
      const result = await goldService.getTransactions(req.user!.userId, {
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
        type: type as string | undefined,
      });
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async claimDailyBonus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await goldService.claimDailyBonus(req.user!.userId);
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async demoPurchase(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { package_id } = req.body;
      const userId = req.user!.userId;

      if (!package_id) {
        res.status(400).json({
          success: false,
          message: 'Package ID is required'
        });
        return;
      }

      // 1. Get the package details
      const goldPackage = getPackage(package_id);

      if (!goldPackage) {
        res.status(404).json({
          success: false,
          message: 'Gold package not found'
        });
        return;
      }

      // 2. Calculate total gold (base + bonus)
      const totalGold = getTotalGold(goldPackage);

      // 3. Add gold to user's balance using existing service method
      const result = await goldService.addGold(
        userId,
        totalGold,
        'demo_purchase',
        `Demo purchase: ${goldPackage.name}`
      );

      res.status(200).json({
        success: true,
        message: `Successfully purchased ${totalGold.toLocaleString()} gold!`,
        goldAdded: totalGold,
        newBalance: result.new_balance
      });

    } catch (error) {
      next(error);
    }
  }
}

export const goldController = new GoldController();
