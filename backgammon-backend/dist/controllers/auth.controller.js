"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authController = exports.AuthController = void 0;
const auth_service_1 = require("../services/auth.service");
class AuthController {
    async register(req, res, next) {
        try {
            const result = await auth_service_1.authService.register(req.body);
            res.status(201).json({ success: true, ...result });
        }
        catch (error) {
            next(error);
        }
    }
    async login(req, res, next) {
        try {
            const result = await auth_service_1.authService.login(req.body);
            res.status(200).json({ success: true, ...result });
        }
        catch (error) {
            next(error);
        }
    }
    async refreshToken(req, res, next) {
        try {
            const { refresh_token } = req.body;
            const tokens = await auth_service_1.authService.refreshAccessToken(refresh_token);
            res.status(200).json({ success: true, ...tokens });
        }
        catch (error) {
            next(error);
        }
    }
    async logout(req, res, next) {
        try {
            if (req.user) {
                await auth_service_1.authService.logout(req.user.userId);
            }
            res.status(200).json({ success: true, message: 'Logged out successfully' });
        }
        catch (error) {
            next(error);
        }
    }
    async getProfile(req, res, next) {
        try {
            const user = await auth_service_1.authService.getProfile(req.user.userId);
            res.status(200).json({ success: true, user });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.AuthController = AuthController;
exports.authController = new AuthController();
