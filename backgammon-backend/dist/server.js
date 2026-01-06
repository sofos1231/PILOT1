"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const http_1 = require("http");
const app_1 = __importDefault(require("./app"));
const connection_1 = require("./db/connection");
const websocket_1 = require("./websocket");
const matchmaking_service_1 = require("./services/matchmaking.service");
const PORT = process.env.PORT || 8000;
async function startServer() {
    try {
        // Try to connect to database
        let dbConnected = false;
        try {
            const result = await (0, connection_1.connectDatabase)();
            dbConnected = result !== false;
            if (dbConnected) {
                console.log('✅ Database connected');
                // Only start queue processor if DB is connected
                (0, matchmaking_service_1.startQueueProcessor)();
            }
        }
        catch (dbError) {
            console.warn('⚠️  Database connection failed - server will start without database');
            console.warn('   Some endpoints requiring database will not work');
            console.warn('   Install PostgreSQL and restart the server to enable full functionality');
        }
        // Create HTTP server (needed for WebSocket)
        const server = (0, http_1.createServer)(app_1.default);
        // Initialize WebSocket
        (0, websocket_1.initializeWebSocket)(server);
        console.log('✅ WebSocket initialized');
        // Start listening
        server.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`📍 Health: http://localhost:${PORT}/v1/health`);
            console.log(`📍 API: http://localhost:${PORT}/v1`);
            console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
        });
    }
    catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}
startServer();
