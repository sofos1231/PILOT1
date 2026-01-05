import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { validateRequest } from '../middleware/validation.middleware';
import { authMiddleware } from '../middleware/auth.middleware';
import { authLimiter } from '../middleware/rateLimiter.middleware';
import { registerSchema, loginSchema, refreshTokenSchema } from '../validators/auth.validator';

const router = Router();

// Apply rate limiting to auth routes
router.use(authLimiter);

router.post('/register', validateRequest(registerSchema), authController.register.bind(authController));
router.post('/login', validateRequest(loginSchema), authController.login.bind(authController));
router.post('/refresh', validateRequest(refreshTokenSchema), authController.refreshToken.bind(authController));
router.post('/logout', authMiddleware, authController.logout.bind(authController));
router.get('/profile', authMiddleware, authController.getProfile.bind(authController));

export default router;
