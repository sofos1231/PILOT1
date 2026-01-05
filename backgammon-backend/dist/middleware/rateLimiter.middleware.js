"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.strictLimiter = exports.authLimiter = exports.apiLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
// General API rate limiter
exports.apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: { success: false, error: 'Too many requests', code: 'RATE_LIMIT_EXCEEDED' },
    standardHeaders: true,
    legacyHeaders: false,
});
// Strict limiter for auth endpoints
exports.authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 attempts per window
    message: { success: false, error: 'Too many authentication attempts', code: 'RATE_LIMIT_EXCEEDED' },
    standardHeaders: true,
    legacyHeaders: false,
});
// Very strict limiter for password reset, etc.
exports.strictLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 attempts per hour
    message: { success: false, error: 'Too many requests', code: 'RATE_LIMIT_EXCEEDED' },
    standardHeaders: true,
    legacyHeaders: false,
});
