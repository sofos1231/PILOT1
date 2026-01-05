import dotenv from 'dotenv';
dotenv.config();

import { createServer } from 'http';
import app from './app';
import { connectDatabase } from './db/connection';
// WebSocket will be imported when Lane 4 is implemented:
import { initializeWebSocket } from './websocket';

const PORT = process.env.PORT || 8000;

async function startServer() {
  try {
    // Try to connect to database
    try {
      await connectDatabase();
      console.log('✅ Database connected');
    } catch (dbError) {
      console.warn('⚠️  Database connection failed - server will start without database');
      console.warn('   Some endpoints requiring database will not work');
      console.warn('   Install PostgreSQL and restart the server to enable full functionality');
    }

    // Create HTTP server (needed for WebSocket)
    const server = createServer(app);

    // Initialize WebSocket (uncomment when Lane 4 is complete)
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
