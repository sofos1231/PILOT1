"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.confirmPurchaseSchema = exports.createPurchaseIntentSchema = void 0;
const zod_1 = require("zod");
exports.createPurchaseIntentSchema = zod_1.z.object({
    package_id: zod_1.z.enum(['starter', 'popular', 'premium', 'mega']),
});
exports.confirmPurchaseSchema = zod_1.z.object({
    payment_intent_id: zod_1.z.string().min(1),
});
