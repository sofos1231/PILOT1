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

  // Alias methods for club actions
  joinClub(clubId: string): void {
    this.joinClubRoom(clubId);
  }

  leaveClub(clubId: string): void {
    this.leaveClubRoom(clubId);
  }

  sendClubMessage(clubId: string, message: string): void {
    this.sendChatMessage(clubId, message);
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
