import dotenv from 'dotenv';
dotenv.config();

import { createServer } from 'http';
import app from './app';
import { connectDatabase } from './db/connection';
import { initializeWebSocket } from './websocket';
import { startQueueProcessor } from './services/matchmaking.service';

const PORT = process.env.PORT || 8000;

async function startServer() {
  try {
    // Try to connect to database
    let dbConnected = false;
    try {
      const result = await connectDatabase();
      dbConnected = result !== false;
      if (dbConnected) {
        console.log('✅ Database connected');
        // Only start queue processor if DB is connected
        startQueueProcessor();
      }
    } catch (dbError) {
      console.warn('⚠️  Database connection failed - server will start without database');
      console.warn('   Some endpoints requiring database will not work');
      console.warn('   Install PostgreSQL and restart the server to enable full functionality');
    }

    // Create HTTP server (needed for WebSocket)
    const server = createServer(app);

    // Initialize WebSocket
    initializeWebSocket(server);
    console.log('✅ WebSocket initialized');

    // Start listening
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📍 Health: http://localhost:${PORT}/v1/health`);
      console.log(`📍 API: http://localhost:${PORT}/v1`);
      console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
