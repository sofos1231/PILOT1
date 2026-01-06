"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = exports.isDbConnected = void 0;
exports.connectDatabase = connectDatabase;
exports.requireDb = requireDb;
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Track database connection state
exports.isDbConnected = false;
let connectionAttempts = 0;
const MAX_CONNECTION_LOGS = 3; // Only log first N connection failures
exports.pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});
exports.pool.on('error', (err) => {
    exports.isDbConnected = false;
    // Don't exit on connection errors - just log once
    if (connectionAttempts < MAX_CONNECTION_LOGS) {
        console.error('Database pool error:', err.message);
    }
});
async function connectDatabase() {
    try {
        const client = await exports.pool.connect();
        console.log('✅ Database connected successfully');
        client.release();
        exports.isDbConnected = true;
        connectionAttempts = 0;
        return true;
    }
    catch (error) {
        exports.isDbConnected = false;
        connectionAttempts++;
        if (connectionAttempts <= MAX_CONNECTION_LOGS) {
            console.error(`❌ Database connection failed (attempt ${connectionAttempts}):`, error.message);
            if (connectionAttempts === MAX_CONNECTION_LOGS) {
                console.log('⚠️  Suppressing further connection error logs. Server running in limited mode.');
                console.log('   To use full functionality, start PostgreSQL on port 5433 or update DATABASE_URL in .env');
            }
        }
        return false;
    }
}
// Utility function to check if DB is available before queries
function requireDb() {
    if (!exports.isDbConnected) {
        throw new Error('Database not connected');
    }
}
exports.default = exports.pool;
