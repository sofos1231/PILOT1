"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.randomUtils = void 0;
const crypto_1 = __importDefault(require("crypto"));
exports.randomUtils = {
    /**
     * Generate cryptographically secure random integer between min and max (inclusive)
     */
    randomInt(min, max) {
        return crypto_1.default.randomInt(min, max + 1);
    },
    /**
     * Roll a single die (1-6)
     */
    rollDie() {
        return this.randomInt(1, 6);
    },
};
