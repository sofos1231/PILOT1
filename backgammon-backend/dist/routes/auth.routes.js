"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("../controllers/auth.controller");
const validation_middleware_1 = require("../middleware/validation.middleware");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rateLimiter_middleware_1 = require("../middleware/rateLimiter.middleware");
const auth_validator_1 = require("../validators/auth.validator");
const router = (0, express_1.Router)();
// Apply rate limiting to auth routes
router.use(rateLimiter_middleware_1.authLimiter);
router.post('/register', (0, validation_middleware_1.validateRequest)(auth_validator_1.registerSchema), auth_controller_1.authController.register.bind(auth_controller_1.authController));
router.post('/login', (0, validation_middleware_1.validateRequest)(auth_validator_1.loginSchema), auth_controller_1.authController.login.bind(auth_controller_1.authController));
router.post('/refresh', (0, validation_middleware_1.validateRequest)(auth_validator_1.refreshTokenSchema), auth_controller_1.authController.refreshToken.bind(auth_controller_1.authController));
router.post('/logout', auth_middleware_1.authMiddleware, auth_controller_1.authController.logout.bind(auth_controller_1.authController));
router.get('/profile', auth_middleware_1.authMiddleware, auth_controller_1.authController.getProfile.bind(auth_controller_1.authController));
exports.default = router;
