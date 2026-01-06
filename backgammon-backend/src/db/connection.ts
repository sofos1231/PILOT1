import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Track database connection state
export let isDbConnected = false;
let connectionAttempts = 0;
const MAX_CONNECTION_LOGS = 3; // Only log first N connection failures

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  isDbConnected = false;
  // Don't exit on connection errors - just log once
  if (connectionAttempts < MAX_CONNECTION_LOGS) {
    console.error('Database pool error:', err.message);
  }
});

export async function connectDatabase(): Promise<boolean> {
  try {
    const client = await pool.connect();
    console.log('✅ Database connected successfully');
    client.release();
    isDbConnected = true;
    connectionAttempts = 0;
    return true;
  } catch (error: any) {
    isDbConnected = false;
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
export function requireDb(): void {
  if (!isDbConnected) {
    throw new Error('Database not connected');
  }
}

export default pool;
