"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.goldController = exports.GoldController = void 0;
const gold_service_1 = require("../services/gold.service");
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
}
exports.GoldController = GoldController;
exports.goldController = new GoldController();
