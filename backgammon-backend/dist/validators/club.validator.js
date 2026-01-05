"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTableSchema = exports.grantChipsSchema = exports.updateClubSchema = exports.createClubSchema = void 0;
const zod_1 = require("zod");
exports.createClubSchema = zod_1.z.object({
    name: zod_1.z.string()
        .min(3, 'Name must be at least 3 characters')
        .max(50, 'Name must be at most 50 characters'),
    description: zod_1.z.string().max(500).optional(),
    logo_url: zod_1.z.string().url().optional().nullable(),
    privacy: zod_1.z.enum(['public', 'private']).optional(),
    welcome_bonus: zod_1.z.number().min(0).max(100000).optional(),
});
exports.updateClubSchema = zod_1.z.object({
    name: zod_1.z.string().min(3).max(50).optional(),
    description: zod_1.z.string().max(500).optional().nullable(),
    logo_url: zod_1.z.string().url().optional().nullable(),
    privacy: zod_1.z.enum(['public', 'private']).optional(),
    welcome_bonus: zod_1.z.number().min(0).max(100000).optional(),
});
exports.grantChipsSchema = zod_1.z.object({
    user_id: zod_1.z.string().uuid(),
    amount: zod_1.z.number().positive().max(10000),
    reason: zod_1.z.string().max(200).optional(),
});
exports.createTableSchema = zod_1.z.object({
    stake_amount: zod_1.z.number().positive(),
});
