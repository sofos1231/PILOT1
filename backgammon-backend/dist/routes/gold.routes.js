"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const gold_controller_1 = require("../controllers/gold.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const validation_middleware_1 = require("../middleware/validation.middleware");
const gold_validator_1 = require("../validators/gold.validator");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_middleware_1.authMiddleware);
router.get('/balance', gold_controller_1.goldController.getBalance.bind(gold_controller_1.goldController));
router.get('/packages', gold_controller_1.goldController.getPackages.bind(gold_controller_1.goldController));
router.get('/transactions', gold_controller_1.goldController.getTransactions.bind(gold_controller_1.goldController));
router.post('/daily-bonus/claim', gold_controller_1.goldController.claimDailyBonus.bind(gold_controller_1.goldController));
router.post('/purchase/intent', (0, validation_middleware_1.validateRequest)(gold_validator_1.createPurchaseIntentSchema), gold_controller_1.goldController.createPurchaseIntent.bind(gold_controller_1.goldController));
router.post('/purchase/confirm', (0, validation_middleware_1.validateRequest)(gold_validator_1.confirmPurchaseSchema), gold_controller_1.goldController.confirmPurchase.bind(gold_controller_1.goldController));
router.post('/demo-purchase', gold_controller_1.goldController.demoPurchase.bind(gold_controller_1.goldController));
exports.default = router;
