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
