"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.goldController = exports.GoldController = void 0;
const gold_service_1 = require("../services/gold.service");
const packages_1 = require("../config/packages");
class GoldController {
    async getBalance(req, res, next) {
        try {
            const result = await gold_service_1.goldService.getBalance(req.user.userId);
            res.status(200).json({ success: true, ...result });
        }
        catch (error) {
            next(error);
        }
    }
    async getPackages(req, res, next) {
        try {
            const result = gold_service_1.goldService.getPackages();
            res.status(200).json({ success: true, ...result });
        }
        catch (error) {
            next(error);
        }
    }
    async createPurchaseIntent(req, res, next) {
        try {
            const { package_id } = req.body;
            const result = await gold_service_1.goldService.createPurchaseIntent(req.user.userId, package_id);
            res.status(200).json({ success: true, ...result });
        }
        catch (error) {
            next(error);
        }
    }
    async confirmPurchase(req, res, next) {
        try {
            const { payment_intent_id } = req.body;
            const result = await gold_service_1.goldService.confirmPurchase(payment_intent_id);
            res.status(200).json({ success: true, ...result });
        }
        catch (error) {
            next(error);
        }
    }
    async getTransactions(req, res, next) {
        try {
            const { limit, offset, type } = req.query;
            const result = await gold_service_1.goldService.getTransactions(req.user.userId, {
                limit: limit ? parseInt(limit) : undefined,
                offset: offset ? parseInt(offset) : undefined,
                type: type,
            });
            res.status(200).json({ success: true, ...result });
        }
        catch (error) {
            next(error);
        }
    }
    async claimDailyBonus(req, res, next) {
        try {
            const result = await gold_service_1.goldService.claimDailyBonus(req.user.userId);
            res.status(200).json({ success: true, ...result });
        }
        catch (error) {
            next(error);
        }
    }
    async demoPurchase(req, res, next) {
        try {
            const { package_id } = req.body;
            const userId = req.user.userId;
            if (!package_id) {
                res.status(400).json({
                    success: false,
                    message: 'Package ID is required'
                });
                return;
            }
            // 1. Get the package details
            const goldPackage = (0, packages_1.getPackage)(package_id);
            if (!goldPackage) {
                res.status(404).json({
                    success: false,
                    message: 'Gold package not found'
                });
                return;
            }
            // 2. Calculate total gold (base + bonus)
            const totalGold = (0, packages_1.getTotalGold)(goldPackage);
            // 3. Add gold to user's balance using existing service method
            const result = await gold_service_1.goldService.addGold(userId, totalGold, 'demo_purchase', `Demo purchase: ${goldPackage.name}`);
            res.status(200).json({
                success: true,
                message: `Successfully purchased ${totalGold.toLocaleString()} gold!`,
                goldAdded: totalGold,
                newBalance: result.new_balance
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.GoldController = GoldController;
exports.goldController = new GoldController();
