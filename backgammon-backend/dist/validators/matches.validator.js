"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitMovesSchema = exports.createMatchSchema = void 0;
const zod_1 = require("zod");
exports.createMatchSchema = zod_1.z.object({
    match_type: zod_1.z.enum(['gold', 'club']),
    stake_amount: zod_1.z.number().int().min(100).max(1000000),
    club_id: zod_1.z.string().uuid().optional(),
    doubling_cube_enabled: zod_1.z.boolean().optional().default(true),
});
exports.submitMovesSchema = zod_1.z.object({
    moves: zod_1.z.array(zod_1.z.object({
        from: zod_1.z.number().int().min(-1).max(23),
        to: zod_1.z.number().int().min(-1).max(23),
        die_value: zod_1.z.number().int().min(1).max(6),
    })).min(0).max(4),
});
