# ⚡ LANE 4: REAL-TIME WEBSOCKET (FIXED)
## Live Gameplay, Chat, and Notifications
## ✅ ALL ISSUES PATCHED

---

## YOUR MISSION
Build real-time features with WebSocket:
- Backend: Socket.IO server with authentication
- Match events: turns, moves, game completion
- Club events: chat, member status, table updates
- Notifications: push to connected clients

---

## PREREQUISITES
- **Lane 1 must be complete** (backend running)
- **Lane 2 must be complete** (frontend running)

---

## ⚠️ IMPORTANT: This lane UPDATES files from Lane 1

This lane does NOT replace server.ts - it ADDS to it. The unified server.ts in Lane 1 already has the structure ready for WebSocket.

---

## PHASE 1: Backend WebSocket Setup

### Step 1.1: Install Socket.IO (if not already installed)
```bash
cd /home/claude/backgammon-backend
npm install socket.io
npm install -D @types/socket.io
```

### Step 1.2: Create WebSocket Types
Create `src/types/websocket.types.ts`:
```typescript
import { GameState, Move } from './game.types';

// Events the server sends to clients
export interface ServerToClientEvents {
  // Connection
  authenticated: (data: { user_id: string; username: string }) => void;
  error: (data: { code: string; message: string }) => void;
  
  // Match events
  match_found: (data: { 
    match_id: string; 
    opponent: { user_id: string; username: string; avatar_url?: string } 
  }) => void;
  player_joined: (data: { match_id: string; user_id: string; username: string }) => void;
  player_ready_status: (data: { match_id: string; user_id: string; ready: boolean }) => void;
  match_starting: (data: { match_id: string; starts_in: number }) => void;
  match_started: (data: { match_id: string; game_state: GameState; your_color: string }) => void;
  turn_changed: (data: { 
    match_id: string; 
    current_turn: string; 
    dice: { value: number; used: boolean }[];
    deadline?: string;
  }) => void;
  move_made: (data: { 
    match_id: string; 
    moves: Move[]; 
    game_state: GameState;
    by_user_id: string;
  }) => void;
  match_completed: (data: { 
    match_id: string; 
    winner_id: string;
    winner_username: string;
    result: {
      win_type: string;
      gold_won: number;
    };
  }) => void;
  opponent_disconnected: (data: { match_id: string; user_id: string; reconnect_deadline: string }) => void;
  opponent_reconnected: (data: { match_id: string; user_id: string }) => void;
  
  // Club events
  club_chat_message: (data: { 
    club_id: string; 
    message: {
      message_id: string;
      user_id: string;
      username: string;
      avatar_url?: string;
      content: string;
      timestamp: string;
    }
  }) => void;
  club_member_online: (data: { club_id: string; user_id: string; username: string }) => void;
  club_member_offline: (data: { club_id: string; user_id: string }) => void;
  club_table_created: (data: { club_id: string; table: any }) => void;
  club_table_started: (data: { club_id: string; table_id: string; match_id: string }) => void;
  club_chips_received: (data: { 
    club_id: string; 
    amount: number; 
    new_balance: number; 
    from_user: { user_id: string; username: string } 
  }) => void;
  
  // Notifications
  notification: (data: { 
    id: string;
    type: string;
    title: string;
    message: string;
    data?: any;
    timestamp: string;
  }) => void;
  
  // Gold updates
  gold_balance_updated: (data: { balance: number; change: number; reason: string }) => void;
  
  // Heartbeat
  pong: () => void;
}

// Events clients send to the server
export interface ClientToServerEvents {
  // Auth (sent automatically via handshake, but can re-auth)
  authenticate: (data: { token: string }) => void;
  
  // Match
  join_match: (data: { match_id: string }) => void;
  leave_match: (data: { match_id: string }) => void;
  player_ready: (data: { match_id: string }) => void;
  submit_moves: (data: { match_id: string; moves: Move[] }) => void;
  
  // Club
  join_club_room: (data: { club_id: string }) => void;
  leave_club_room: (data: { club_id: string }) => void;
  send_chat_message: (data: { club_id: string; content: string }) => void;
  
  // Heartbeat
  ping: () => void;
}

// Data stored on socket
export interface SocketData {
  userId: string;
  email: string;
  username: string;
}
```

### Step 1.3: Create WebSocket Server (FIXED - complete implementation)
Create `src/websocket/index.ts`:
```typescript
import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { verifyAccessToken } from '../utils/jwt.utils';
import { usersRepository } from '../repositories/users.repository';
import {
  ServerToClientEvents,
  ClientToServerEvents,
  SocketData,
} from '../types/websocket.types';

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;
type TypedIO = Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;

let io: TypedIO;

// Track user connections: userId -> Set of socketIds
const userSockets = new Map<string, Set<string>>();

// Track which matches/clubs each socket is in
const socketRooms = new Map<string, Set<string>>();

// Rate limiting for chat
const chatRateLimit = new Map<string, number[]>();
const CHAT_RATE_LIMIT = 10; // messages
const CHAT_RATE_WINDOW = 10000; // 10 seconds

export function initializeWebSocket(server: HttpServer): TypedIO {
  io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN === '*' ? '*' : process.env.CORS_ORIGIN?.split(','),
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
  });

  // Authentication middleware
  io.use(async (socket: TypedSocket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = verifyAccessToken(token);
      const user = await usersRepository.findById(decoded.userId);

      if (!user) {
        return next(new Error('User not found'));
      }

      if (!user.is_active || user.is_banned) {
        return next(new Error('Account is not active'));
      }

      // Attach user data to socket
      socket.data.userId = decoded.userId;
      socket.data.email = decoded.email;
      socket.data.username = user.username;

      next();
    } catch (error) {
      console.error('WebSocket auth error:', error);
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket: TypedSocket) => {
    const userId = socket.data.userId;
    const username = socket.data.username;
    
    console.log(`✅ User connected: ${username} (${userId}) - Socket: ${socket.id}`);

    // Track socket
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId)!.add(socket.id);
    socketRooms.set(socket.id, new Set());

    // Join user's personal room for notifications
    socket.join(`user:${userId}`);
    socketRooms.get(socket.id)!.add(`user:${userId}`);

    // Emit authenticated event
    socket.emit('authenticated', { user_id: userId, username });

    // ===== MATCH EVENTS =====
    
    socket.on('join_match', ({ match_id }) => {
      const room = `match:${match_id}`;
      socket.join(room);
      socketRooms.get(socket.id)!.add(room);
      
      console.log(`📍 ${username} joined match room: ${match_id}`);

      // Notify opponent
      socket.to(room).emit('player_joined', {
        match_id,
        user_id: userId,
        username,
      });
    });

    socket.on('leave_match', ({ match_id }) => {
      const room = `match:${match_id}`;
      socket.leave(room);
      socketRooms.get(socket.id)?.delete(room);
      
      console.log(`📍 ${username} left match room: ${match_id}`);
    });

    socket.on('player_ready', ({ match_id }) => {
      const room = `match:${match_id}`;
      
      io.to(room).emit('player_ready_status', {
        match_id,
        user_id: userId,
        ready: true,
      });
    });

    // ===== CLUB EVENTS =====

    socket.on('join_club_room', ({ club_id }) => {
      const room = `club:${club_id}`;
      socket.join(room);
      socketRooms.get(socket.id)!.add(room);
      
      console.log(`📍 ${username} joined club room: ${club_id}`);

      // Notify other club members
      socket.to(room).emit('club_member_online', {
        club_id,
        user_id: userId,
        username,
      });
    });

    socket.on('leave_club_room', ({ club_id }) => {
      const room = `club:${club_id}`;
      socket.leave(room);
      socketRooms.get(socket.id)?.delete(room);

      socket.to(room).emit('club_member_offline', {
        club_id,
        user_id: userId,
      });
    });

    socket.on('send_chat_message', ({ club_id, content }) => {
      // Rate limiting
      if (!checkChatRateLimit(userId)) {
        socket.emit('error', { 
          code: 'RATE_LIMITED', 
          message: 'Too many messages. Please slow down.' 
        });
        return;
      }

      // Sanitize content (basic XSS prevention)
      const sanitizedContent = sanitizeMessage(content);
      
      if (!sanitizedContent || sanitizedContent.length > 500) {
        socket.emit('error', { 
          code: 'INVALID_MESSAGE', 
          message: 'Message is empty or too long' 
        });
        return;
      }

      const message = {
        message_id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        user_id: userId,
        username,
        avatar_url: undefined, // Could fetch from user
        content: sanitizedContent,
        timestamp: new Date().toISOString(),
      };

      // Emit to all club members including sender
      io.to(`club:${club_id}`).emit('club_chat_message', {
        club_id,
        message,
      });
    });

    // ===== HEARTBEAT =====

    socket.on('ping', () => {
      socket.emit('pong');
    });

    // ===== DISCONNECT =====

    socket.on('disconnect', (reason) => {
      console.log(`❌ User disconnected: ${username} (${userId}) - Reason: ${reason}`);

      // Clean up tracking
      const userSocketSet = userSockets.get(userId);
      if (userSocketSet) {
        userSocketSet.delete(socket.id);
        if (userSocketSet.size === 0) {
          userSockets.delete(userId);
        }
      }

      // Notify rooms the user was in
      const rooms = socketRooms.get(socket.id);
      if (rooms) {
        rooms.forEach(room => {
          if (room.startsWith('match:')) {
            const matchId = room.replace('match:', '');
            socket.to(room).emit('opponent_disconnected', {
              match_id: matchId,
              user_id: userId,
              reconnect_deadline: new Date(Date.now() + 60000).toISOString(), // 1 minute
            });
          } else if (room.startsWith('club:')) {
            const clubId = room.replace('club:', '');
            socket.to(room).emit('club_member_offline', {
              club_id: clubId,
              user_id: userId,
            });
          }
        });
        socketRooms.delete(socket.id);
      }
    });
  });

  console.log('✅ WebSocket server initialized');
  return io;
}

// ===== UTILITY FUNCTIONS =====

function checkChatRateLimit(userId: string): boolean {
  const now = Date.now();
  const userMessages = chatRateLimit.get(userId) || [];
  
  // Remove old messages outside window
  const recentMessages = userMessages.filter(time => now - time < CHAT_RATE_WINDOW);
  
  if (recentMessages.length >= CHAT_RATE_LIMIT) {
    return false;
  }
  
  recentMessages.push(now);
  chatRateLimit.set(userId, recentMessages);
  return true;
}

function sanitizeMessage(content: string): string {
  return content
    .trim()
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ===== EXPORTED UTILITIES =====

export function getIO(): TypedIO {
  if (!io) {
    throw new Error('WebSocket not initialized');
  }
  return io;
}

export const wsUtils = {
  /**
   * Emit to a specific user (all their connected devices)
   */
  emitToUser<E extends keyof ServerToClientEvents>(
    userId: string,
    event: E,
    data: Parameters<ServerToClientEvents[E]>[0]
  ): void {
    io.to(`user:${userId}`).emit(event, data as any);
  },

  /**
   * Emit to all participants in a match
   */
  emitToMatch<E extends keyof ServerToClientEvents>(
    matchId: string,
    event: E,
    data: Parameters<ServerToClientEvents[E]>[0]
  ): void {
    io.to(`match:${matchId}`).emit(event, data as any);
  },

  /**
   * Emit to all members in a club
   */
  emitToClub<E extends keyof ServerToClientEvents>(
    clubId: string,
    event: E,
    data: Parameters<ServerToClientEvents[E]>[0]
  ): void {
    io.to(`club:${clubId}`).emit(event, data as any);
  },

  /**
   * Check if a user is online
   */
  isUserOnline(userId: string): boolean {
    const sockets = userSockets.get(userId);
    return !!sockets && sockets.size > 0;
  },

  /**
   * Get count of online users
   */
  getOnlineUserCount(): number {
    return userSockets.size;
  },

  /**
   * Get all socket IDs for a user
   */
  getUserSockets(userId: string): string[] {
    return Array.from(userSockets.get(userId) || []);
  },
};
```

### Step 1.4: Update Server.ts to Enable WebSocket
Update `src/server.ts` - uncomment the WebSocket lines:
```typescript
import dotenv from 'dotenv';
dotenv.config();

import { createServer } from 'http';
import app from './app';
import { connectDatabase } from './db/connection';
import { initializeWebSocket } from './websocket';  // UNCOMMENT THIS

const PORT = process.env.PORT || 8000;

async function startServer() {
  try {
    await connectDatabase();
    console.log('✅ Database connected');

    const server = createServer(app);

    // UNCOMMENT THESE LINES:
    initializeWebSocket(server);
    console.log('✅ WebSocket initialized');

    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📍 Health: http://localhost:${PORT}/v1/health`);
      console.log(`📍 API: http://localhost:${PORT}/v1`);
      console.log(`🔌 WebSocket: ws://localhost:${PORT}`);  // ADD THIS
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
```

---

## PHASE 2: Integrate WebSocket with Services

### Step 2.1: Update Matches Service to Emit Events
Add to `src/services/matches.service.ts` (at the top):
```typescript
import { wsUtils } from '../websocket';
```

Then add WebSocket emissions in the appropriate methods. For example, after `startMatch`:
```typescript
// After starting match, emit to both players
wsUtils.emitToMatch(matchId, 'match_started', {
  match_id: matchId,
  game_state: stateWithDice,
  your_color: 'white', // Will need to emit separately with correct color
});
```

---

## PHASE 3: Frontend WebSocket Client

### Step 3.1: Create WebSocket Service (FIXED - uses config)
Create `services/websocket.ts`:
```typescript
import { io, Socket } from 'socket.io-client';
import { API_CONFIG } from '../config/api.config';
import { useAuthStore } from '../store/authStore';
import { GameState, Move } from '../types/game.types';

// Types matching backend
interface ServerToClientEvents {
  authenticated: (data: { user_id: string; username: string }) => void;
  error: (data: { code: string; message: string }) => void;
  match_found: (data: { match_id: string; opponent: any }) => void;
  player_joined: (data: { match_id: string; user_id: string; username: string }) => void;
  player_ready_status: (data: { match_id: string; user_id: string; ready: boolean }) => void;
  match_starting: (data: { match_id: string; starts_in: number }) => void;
  match_started: (data: { match_id: string; game_state: GameState; your_color: string }) => void;
  turn_changed: (data: { match_id: string; current_turn: string; dice: any[]; deadline?: string }) => void;
  move_made: (data: { match_id: string; moves: Move[]; game_state: GameState; by_user_id: string }) => void;
  match_completed: (data: { match_id: string; winner_id: string; winner_username: string; result: any }) => void;
  opponent_disconnected: (data: { match_id: string; user_id: string; reconnect_deadline: string }) => void;
  opponent_reconnected: (data: { match_id: string; user_id: string }) => void;
  club_chat_message: (data: { club_id: string; message: any }) => void;
  club_member_online: (data: { club_id: string; user_id: string; username: string }) => void;
  club_member_offline: (data: { club_id: string; user_id: string }) => void;
  club_table_created: (data: { club_id: string; table: any }) => void;
  notification: (data: { id: string; type: string; title: string; message: string; data?: any; timestamp: string }) => void;
  gold_balance_updated: (data: { balance: number; change: number; reason: string }) => void;
  pong: () => void;
}

interface ClientToServerEvents {
  authenticate: (data: { token: string }) => void;
  join_match: (data: { match_id: string }) => void;
  leave_match: (data: { match_id: string }) => void;
  player_ready: (data: { match_id: string }) => void;
  submit_moves: (data: { match_id: string; moves: Move[] }) => void;
  join_club_room: (data: { club_id: string }) => void;
  leave_club_room: (data: { club_id: string }) => void;
  send_chat_message: (data: { club_id: string; content: string }) => void;
  ping: () => void;
}

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

class WebSocketService {
  private socket: TypedSocket | null = null;
  private listeners: Map<string, Set<Function>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private isIntentionalDisconnect = false;

  /**
   * Connect to WebSocket server
   */
  connect(): void {
    const { accessToken, isAuthenticated } = useAuthStore.getState();

    if (!accessToken || !isAuthenticated) {
      console.log('🔌 WebSocket: No auth token, skipping connection');
      return;
    }

    if (this.socket?.connected) {
      console.log('🔌 WebSocket: Already connected');
      return;
    }

    console.log('🔌 WebSocket: Connecting to', API_CONFIG.WS_URL);
    this.isIntentionalDisconnect = false;

    this.socket = io(API_CONFIG.WS_URL, {
      auth: { token: accessToken },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    this.setupEventHandlers();
  }

  /**
   * Setup core event handlers
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('✅ WebSocket: Connected');
      this.reconnectAttempts = 0;
    });

    this.socket.on('authenticated', (data) => {
      console.log('✅ WebSocket: Authenticated as', data.username);
      this.notifyListeners('authenticated', data);
    });

    this.socket.on('error', (data) => {
      console.error('❌ WebSocket error:', data);
      this.notifyListeners('error', data);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 WebSocket: Disconnected -', reason);
      
      if (!this.isIntentionalDisconnect && reason === 'io server disconnect') {
        // Server disconnected us, try to reconnect
        this.socket?.connect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error.message);
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('❌ WebSocket: Max reconnection attempts reached');
      }
    });

    // Forward all game events to listeners
    const forwardEvents = [
      'match_found',
      'player_joined',
      'player_ready_status',
      'match_starting',
      'match_started',
      'turn_changed',
      'move_made',
      'match_completed',
      'opponent_disconnected',
      'opponent_reconnected',
      'club_chat_message',
      'club_member_online',
      'club_member_offline',
      'club_table_created',
      'notification',
      'gold_balance_updated',
    ] as const;

    forwardEvents.forEach(event => {
      this.socket?.on(event, (data: any) => {
        this.notifyListeners(event, data);
      });
    });

    this.socket.on('pong', () => {
      this.notifyListeners('pong', {});
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.isIntentionalDisconnect = true;
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.listeners.clear();
  }

  /**
   * Subscribe to an event
   */
  on(event: string, callback: Function): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  /**
   * Notify all listeners for an event
   */
  private notifyListeners(event: string, data: any): void {
    this.listeners.get(event)?.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in WebSocket listener for ${event}:`, error);
      }
    });
  }

  // ===== MATCH ACTIONS =====

  joinMatch(matchId: string): void {
    this.socket?.emit('join_match', { match_id: matchId });
  }

  leaveMatch(matchId: string): void {
    this.socket?.emit('leave_match', { match_id: matchId });
  }

  setReady(matchId: string): void {
    this.socket?.emit('player_ready', { match_id: matchId });
  }

  submitMoves(matchId: string, moves: Move[]): void {
    this.socket?.emit('submit_moves', { match_id: matchId, moves });
  }

  // ===== CLUB ACTIONS =====

  joinClubRoom(clubId: string): void {
    this.socket?.emit('join_club_room', { club_id: clubId });
  }

  leaveClubRoom(clubId: string): void {
    this.socket?.emit('leave_club_room', { club_id: clubId });
  }

  sendChatMessage(clubId: string, content: string): void {
    this.socket?.emit('send_chat_message', { club_id: clubId, content });
  }

  // ===== UTILITY =====

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  ping(): void {
    this.socket?.emit('ping');
  }
}

// Export singleton instance
export const wsService = new WebSocketService();
```

### Step 3.2: Create WebSocket Hooks
Create `hooks/useWebSocket.ts`:
```typescript
import { useEffect, useRef, useCallback } from 'react';
import { wsService } from '../services/websocket';
import { useAuthStore } from '../store/authStore';
import { Move } from '../types/game.types';

/**
 * Hook to manage WebSocket connection lifecycle
 */
export function useWebSocket() {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const updateGoldBalance = useAuthStore(state => state.updateGoldBalance);

  useEffect(() => {
    if (isAuthenticated) {
      wsService.connect();

      // Listen for gold updates
      const unsubGold = wsService.on('gold_balance_updated', (data: any) => {
        updateGoldBalance(data.balance);
      });

      return () => {
        unsubGold();
        // Don't disconnect on unmount - keep connection alive
      };
    } else {
      wsService.disconnect();
    }
  }, [isAuthenticated, updateGoldBalance]);

  return {
    isConnected: wsService.isConnected(),
    disconnect: () => wsService.disconnect(),
  };
}

/**
 * Hook for match-specific WebSocket events
 */
export function useMatchSocket(matchId: string | undefined) {
  const cleanupRef = useRef<Function[]>([]);

  useEffect(() => {
    if (!matchId) return;

    // Join match room
    wsService.joinMatch(matchId);

    return () => {
      // Leave match room
      wsService.leaveMatch(matchId);
      
      // Clean up listeners
      cleanupRef.current.forEach(fn => fn());
      cleanupRef.current = [];
    };
  }, [matchId]);

  const subscribe = useCallback((event: string, callback: Function) => {
    const unsubscribe = wsService.on(event, callback);
    cleanupRef.current.push(unsubscribe);
    return unsubscribe;
  }, []);

  return {
    subscribe,
    setReady: () => matchId && wsService.setReady(matchId),
    submitMoves: (moves: Move[]) => matchId && wsService.submitMoves(matchId, moves),
  };
}

/**
 * Hook for club-specific WebSocket events
 */
export function useClubSocket(clubId: string | undefined) {
  const cleanupRef = useRef<Function[]>([]);

  useEffect(() => {
    if (!clubId) return;

    // Join club room
    wsService.joinClubRoom(clubId);

    return () => {
      // Leave club room
      wsService.leaveClubRoom(clubId);
      
      // Clean up listeners
      cleanupRef.current.forEach(fn => fn());
      cleanupRef.current = [];
    };
  }, [clubId]);

  const subscribe = useCallback((event: string, callback: Function) => {
    const unsubscribe = wsService.on(event, callback);
    cleanupRef.current.push(unsubscribe);
    return unsubscribe;
  }, []);

  const sendMessage = useCallback((content: string) => {
    if (clubId) {
      wsService.sendChatMessage(clubId, content);
    }
  }, [clubId]);

  return {
    subscribe,
    sendMessage,
  };
}
```

### Step 3.3: Update App Layout to Initialize WebSocket
Update `app/_layout.tsx` to use the WebSocket hook:
```typescript
import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../store/authStore';
import { useWebSocket } from '../hooks/useWebSocket';  // ADD THIS

function LoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#667eea" />
    </View>
  );
}

export default function RootLayout() {
  const { isAuthenticated, isLoading, isHydrated } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const [isNavigationReady, setNavigationReady] = useState(false);

  // Initialize WebSocket connection when authenticated
  useWebSocket();  // ADD THIS

  // ... rest of the component stays the same
}
```

---

## PHASE 4: Testing

### Step 4.1: Test WebSocket Connection
1. Start backend: `npm run dev`
2. Check for "✅ WebSocket initialized" in console
3. Start frontend: `npx expo start`
4. Login to app
5. Check backend console for "✅ User connected: username"
6. Check frontend console for "✅ WebSocket: Authenticated"

### Step 4.2: Test Match Events (Manual)
```javascript
// In backend, you can test emissions:
const { wsUtils } = require('./websocket');
wsUtils.emitToUser('user-id-here', 'notification', {
  id: 'test',
  type: 'test',
  title: 'Test',
  message: 'Hello!',
  timestamp: new Date().toISOString(),
});
```

---

## ✅ LANE 4 COMPLETION CHECKLIST

### Backend
- [ ] Socket.IO installed
- [ ] WebSocket types defined with all events
- [ ] WebSocket server initialized with auth
- [ ] User socket tracking implemented
- [ ] Match room joining/leaving works
- [ ] Club room joining/leaving works
- [ ] Chat messages broadcast with rate limiting
- [ ] Message sanitization implemented
- [ ] Server.ts updated to initialize WebSocket
- [ ] wsUtils exported for service use

### Frontend
- [ ] Socket.IO client installed
- [ ] WebSocket service created with config
- [ ] Event subscription system works
- [ ] useWebSocket hook connects on auth
- [ ] useMatchSocket hook for match events
- [ ] useClubSocket hook for club events
- [ ] Root layout uses useWebSocket
- [ ] WebSocket connects successfully
- [ ] Authenticated event received

**When all items are checked, LANE 4 IS COMPLETE!**

---

## 📁 FILES CREATED/MODIFIED IN LANE 4

### Backend
```
src/
├── types/
│   └── websocket.types.ts (NEW)
├── websocket/
│   └── index.ts (NEW)
└── server.ts (MODIFIED - uncomment WebSocket lines)
```

### Frontend
```
services/
└── websocket.ts (NEW)
hooks/
└── useWebSocket.ts (NEW)
app/
└── _layout.tsx (MODIFIED - add useWebSocket)
```
