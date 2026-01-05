"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorMiddleware = errorMiddleware;
const AppError_1 = require("../errors/AppError");
function errorMiddleware(error, req, res, next) {
    // Log error for debugging (in production, use proper logger)
    console.error(`[ERROR] ${req.method} ${req.path}:`, error.message);
    if (error instanceof AppError_1.AppError) {
        res.status(error.statusCode).json({
            success: false,
            error: error.message,
            code: error.code,
            ...(error.details && process.env.NODE_ENV === 'development' && { details: error.details }),
        });
        return;
    }
    // Don't expose internal error details in production
    res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        code: 'INTERNAL_ERROR',
    });
}
