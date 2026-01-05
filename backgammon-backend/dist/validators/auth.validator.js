"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshTokenSchema = exports.loginSchema = exports.registerSchema = void 0;
const zod_1 = require("zod");
exports.registerSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email format').max(255),
    username: zod_1.z.string()
        .min(3, 'Username must be at least 3 characters')
        .max(20, 'Username must be at most 20 characters')
        .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
    password: zod_1.z.string()
        .min(8, 'Password must be at least 8 characters')
        .max(100, 'Password must be at most 100 characters'),
    avatar_url: zod_1.z.string().url().optional().nullable(),
    country: zod_1.z.string().length(3, 'Country code must be 3 characters'),
    age_confirmed: zod_1.z.boolean().refine(val => val === true, 'Age confirmation is required'),
});
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email format'),
    password: zod_1.z.string().min(1, 'Password is required'),
});
exports.refreshTokenSchema = zod_1.z.object({
    refresh_token: zod_1.z.string().min(1, 'Refresh token is required'),
});
