"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
exports.optionalAuth = optionalAuth;
const jwt_utils_1 = require("../utils/jwt.utils");
const AppError_1 = require("../errors/AppError");
async function authMiddleware(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new AppError_1.AuthenticationError('No token provided');
        }
        const token = authHeader.substring(7);
        const decoded = (0, jwt_utils_1.verifyAccessToken)(token);
        req.user = { userId: decoded.userId, email: decoded.email };
        next();
    }
    catch (error) {
        next(new AppError_1.AuthenticationError('Invalid or expired token'));
    }
}
function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
            const decoded = (0, jwt_utils_1.verifyAccessToken)(token);
            req.user = { userId: decoded.userId, email: decoded.email };
        }
        catch {
            // Token invalid, but that's okay for optional auth
        }
    }
    next();
}
