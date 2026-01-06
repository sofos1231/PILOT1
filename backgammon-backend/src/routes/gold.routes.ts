import { Router } from 'express';
import { goldController } from '../controllers/gold.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { createPurchaseIntentSchema, confirmPurchaseSchema } from '../validators/gold.validator';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

router.get('/balance', goldController.getBalance.bind(goldController));
router.get('/packages', goldController.getPackages.bind(goldController));
router.get('/transactions', goldController.getTransactions.bind(goldController));
router.post('/daily-bonus/claim', goldController.claimDailyBonus.bind(goldController));
router.post('/purchase/intent', validateRequest(createPurchaseIntentSchema), goldController.createPurchaseIntent.bind(goldController));
router.post('/purchase/confirm', validateRequest(confirmPurchaseSchema), goldController.confirmPurchase.bind(goldController));
router.post('/demo-purchase', goldController.demoPurchase.bind(goldController));

export default router;
