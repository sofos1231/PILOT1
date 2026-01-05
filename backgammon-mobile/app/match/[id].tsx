import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMatchStore } from '../../store/matchStore';
import { useAuthStore } from '../../store/authStore';
import { matchApi } from '../../services/api/matchApi';
import { wsService } from '../../services/websocket';

export default function MatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  const {
    matchId,
    myColor,
    opponent,
    gameState,
    isMyTurn,
    isReady,
    opponentReady,
    matchStatus,
    setMatch,
    setGameState,
    setLegalMoves,
    setReady,
    setOpponentReady,
    setMatchStatus,
    clearMatch,
  } = useMatchStore();

  const [loading, setLoading] = useState(true);
  const [rolling, setRolling] = useState(false);

  // Load match data
  useEffect(() => {
    if (!id) return;

    const loadMatch = async () => {
      try {
        const { data } = await matchApi.getMatch(id);
        const match = data.match;

        setMatch({
          matchId: id,
          matchType: match.match_type,
          stakeAmount: match.stake_amount,
          myColor: match.your_color,
          opponent: {
            user_id: match.your_color === 'white' ? match.player_black_id : match.player_white_id,
            username: match.your_color === 'white' ? match.player_black_username : match.player_white_username,
          },
        });

        if (match.game_state) {
          setGameState(match.game_state);
        }

        setMatchStatus(match.status);
        setReady(match.your_color === 'white' ? match.player_white_ready : match.player_black_ready);
        setOpponentReady(match.your_color === 'white' ? match.player_black_ready : match.player_white_ready);

      } catch (error) {
        console.error('Failed to load match:', error);
        Alert.alert('Error', 'Failed to load match');
        router.back();
      } finally {
        setLoading(false);
      }
    };

    loadMatch();

    // Join match room
    wsService.joinMatch(id);

    return () => {
      wsService.leaveMatch(id);
      clearMatch();
    };
  }, [id]);

  // WebSocket event listeners
  useEffect(() => {
    const unsubReady = wsService.on('player_ready_status', (data: any) => {
      if (data.match_id === id && data.user_id !== user?.user_id) {
        setOpponentReady(data.ready);
      }
    });

    const unsubStarted = wsService.on('match_started', (data: any) => {
      if (data.match_id === id) {
        setGameState(data.game_state);
        setMatchStatus('in_progress');
      }
    });

    const unsubMove = wsService.on('move_made', (data: any) => {
      if (data.match_id === id) {
        setGameState(data.game_state);
      }
    });

    const unsubComplete = wsService.on('match_completed', (data: any) => {
      if (data.match_id === id) {
        setMatchStatus('completed');
        const won = data.winner === user?.user_id;
        Alert.alert(
          won ? 'Victory!' : 'Defeat',
          won ? 'You won the match!' : 'Better luck next time!',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      }
    });

    return () => {
      unsubReady();
      unsubStarted();
      unsubMove();
      unsubComplete();
    };
  }, [id, myColor, user]);

  // Handle ready
  const handleReady = async () => {
    try {
      const { data } = await matchApi.setReady(id!);
      setReady(true);

      if (data.both_ready && data.game_state) {
        setGameState(data.game_state);
        setMatchStatus('in_progress');
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to set ready');
    }
  };

  // Handle roll dice
  const handleRoll = async () => {
    if (!isMyTurn || rolling) return;

    setRolling(true);
    try {
      const { data } = await matchApi.rollDice(id!);
      setGameState((prev: any) => ({ ...prev, dice: data.dice }));
      setLegalMoves(data.legal_moves);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to roll dice');
    } finally {
      setRolling(false);
    }
  };

  // Handle forfeit
  const handleForfeit = () => {
    Alert.alert(
      'Forfeit Match',
      'Are you sure you want to forfeit? You will lose the stake.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Forfeit',
          style: 'destructive',
          onPress: async () => {
            try {
              await matchApi.forfeit(id!);
              router.back();
            } catch (error) {
              Alert.alert('Error', 'Failed to forfeit');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>Loading match...</Text>
      </View>
    );
  }

  // Ready screen
  if (matchStatus === 'ready' || matchStatus === 'waiting') {
    return (
      <>
        <Stack.Screen options={{ headerTitle: 'Match' }} />
        <View style={styles.readyContainer}>
          <Text style={styles.readyTitle}>Match Found!</Text>
          <Text style={styles.opponentName}>vs {opponent?.username}</Text>
          <Text style={styles.stakeText}>{useMatchStore.getState().stakeAmount} gold</Text>

          <View style={styles.readyStatus}>
            <View style={styles.playerStatus}>
              <Text style={styles.playerName}>You</Text>
              <Ionicons
                name={isReady ? 'checkmark-circle' : 'ellipse-outline'}
                size={32}
                color={isReady ? '#10B981' : '#ccc'}
              />
            </View>
            <View style={styles.playerStatus}>
              <Text style={styles.playerName}>{opponent?.username}</Text>
              <Ionicons
                name={opponentReady ? 'checkmark-circle' : 'ellipse-outline'}
                size={32}
                color={opponentReady ? '#10B981' : '#ccc'}
              />
            </View>
          </View>

          {!isReady ? (
            <TouchableOpacity style={styles.readyButton} onPress={handleReady}>
              <Text style={styles.readyButtonText}>I'm Ready!</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.waitingText}>Waiting for opponent...</Text>
          )}
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: `vs ${opponent?.username}`,
          headerRight: () => (
            <TouchableOpacity onPress={handleForfeit}>
              <Ionicons name="flag-outline" size={24} color="#DC2626" />
            </TouchableOpacity>
          ),
        }}
      />
      <View style={styles.container}>
        {/* Opponent info */}
        <View style={styles.playerBar}>
          <Text style={styles.playerBarName}>{opponent?.username}</Text>
          <Text style={styles.playerBarColor}>
            {myColor === 'white' ? 'Black' : 'White'}
          </Text>
        </View>

        {/* Game Board Placeholder */}
        <View style={styles.boardContainer}>
          <Text style={styles.boardText}>Backgammon Board</Text>
          <Text style={styles.infoText}>
            Dice: {gameState?.dice.map(d => d.value).join(', ') || 'None'}
          </Text>
          <Text style={styles.infoText}>
            Your pieces off: {gameState?.off[myColor!] || 0}/15
          </Text>
        </View>

        {/* Your info */}
        <View style={[styles.playerBar, styles.playerBarBottom]}>
          <Text style={styles.playerBarName}>You</Text>
          <Text style={styles.playerBarColor}>
            {myColor === 'white' ? 'White' : 'Black'}
          </Text>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          {isMyTurn ? (
            gameState?.dice.every(d => d.used) || gameState?.dice.length === 0 ? (
              <TouchableOpacity
                style={[styles.rollButton, rolling && styles.rollButtonDisabled]}
                onPress={handleRoll}
                disabled={rolling}
              >
                {rolling ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.rollButtonText}>Roll Dice</Text>
                )}
              </TouchableOpacity>
            ) : (
              <Text style={styles.turnText}>Your turn - make your move!</Text>
            )
          ) : (
            <Text style={styles.turnText}>Opponent's turn...</Text>
          )}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' },
  loadingText: { marginTop: 16, fontSize: 16, color: '#666' },
  readyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5', padding: 24 },
  readyTitle: { fontSize: 28, fontWeight: 'bold', color: '#333' },
  opponentName: { fontSize: 20, color: '#666', marginTop: 8 },
  stakeText: { fontSize: 18, color: '#F9A825', marginTop: 16, fontWeight: '600' },
  readyStatus: { flexDirection: 'row', gap: 48, marginTop: 32 },
  playerStatus: { alignItems: 'center', gap: 8 },
  playerName: { fontSize: 16, color: '#333' },
  readyButton: { backgroundColor: '#10B981', paddingHorizontal: 48, paddingVertical: 16, borderRadius: 12, marginTop: 32 },
  readyButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  waitingText: { marginTop: 32, fontSize: 16, color: '#666' },
  container: { flex: 1, backgroundColor: '#2D2D2D' },
  playerBar: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, backgroundColor: '#1a1a1a' },
  playerBarBottom: { backgroundColor: '#333' },
  playerBarName: { color: 'white', fontSize: 16, fontWeight: '600' },
  playerBarColor: { color: '#aaa', fontSize: 14 },
  boardContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  boardText: { fontSize: 24, color: 'white', fontWeight: 'bold' },
  infoText: { fontSize: 14, color: '#aaa', marginTop: 8 },
  controls: { alignItems: 'center', justifyContent: 'center', padding: 16 },
  rollButton: { backgroundColor: '#667eea', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 12 },
  rollButtonDisabled: { opacity: 0.7 },
  rollButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  turnText: { color: 'white', fontSize: 16 },
});
