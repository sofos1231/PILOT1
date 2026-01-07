# 🎮 LANE 10: PLAY TAB COMPLETION - COMPLETE
## Wire Match History & Button Functionality
## Copy-Paste Ready Code

---

## OVERVIEW

**Problem:**
- Match history says "No matches yet" (hardcoded)
- `matchApi.getHistory()` is never called
- Practice button does nothing
- Private Match button does nothing

**Solution:**
- Call getHistory() on mount
- Display real match history
- Wire Practice button to show "Coming Soon"
- Wire Private Match button to show "Coming Soon"
- Add pull-to-refresh

**Time:** 45 minutes

**Prerequisites:**
- Lane 8-9 complete
- Backend running on port 8000

---

## PHASE 1: Replace Play Tab (index.tsx)

### Step 1.1: Replace entire index.tsx

Replace the entire contents of `app/(tabs)/index.tsx`:

```typescript
import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../store/authStore';
import { matchApi } from '../../services/api/matchApi';
import { matchmakingApi } from '../../services/api/matchmakingApi';
import { wsService } from '../../services/websocket';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ==================== TYPES ====================
interface RecentMatch {
  match_id: string;
  match_type: string;
  status: string;
  opponent_id: string;
  opponent_username: string;
  your_color: 'white' | 'black';
  result: 'win' | 'loss' | 'ongoing' | 'draw';
  stake_amount: number;
  gold_change: number;
  created_at: string;
  completed_at: string | null;
}

// ==================== COMPONENT ====================
export default function PlayTab() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  // State
  const [recentMatches, setRecentMatches] = useState<RecentMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showStakeModal, setShowStakeModal] = useState(false);
  const [stake, setStake] = useState('100');
  const [searching, setSearching] = useState(false);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);

  // ==================== DATA FETCHING ====================
  const fetchMatchHistory = useCallback(async () => {
    try {
      const { data } = await matchApi.getHistory(10);
      if (data.success && data.matches) {
        const formatted: RecentMatch[] = data.matches.map((match: any) => {
          const isWhite = match.player_white_id === user?.user_id;
          const opponentId = isWhite ? match.player_black_id : match.player_white_id;
          const opponentUsername = isWhite
            ? match.player_black_username || 'Unknown'
            : match.player_white_username || 'Unknown';

          let result: 'win' | 'loss' | 'ongoing' | 'draw' = 'ongoing';
          let goldChange = 0;

          if (match.status === 'completed') {
            if (match.winner_id === user?.user_id) {
              result = 'win';
              goldChange = match.stake_amount * (match.final_cube_value || 1);
            } else if (match.winner_id) {
              result = 'loss';
              goldChange = -match.stake_amount * (match.final_cube_value || 1);
            } else {
              result = 'draw';
            }
          }

          return {
            match_id: match.match_id,
            match_type: match.match_type,
            status: match.status,
            opponent_id: opponentId,
            opponent_username: opponentUsername,
            your_color: isWhite ? 'white' : 'black',
            result,
            stake_amount: match.stake_amount,
            gold_change: goldChange,
            created_at: match.created_at,
            completed_at: match.completed_at,
          };
        });
        setRecentMatches(formatted);
      }
    } catch (error) {
      console.error('Failed to fetch match history:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchMatchHistory();
    }
  }, [user, fetchMatchHistory]);

  // Listen for match found event
  useEffect(() => {
    const unsubscribe = wsService.on('match_found', (data: any) => {
      setSearching(false);
      setQueuePosition(null);
      router.push(`/match/${data.match_id}`);
    });

    return () => {
      unsubscribe();
    };
  }, [router]);

  // ==================== HANDLERS ====================
  const handleRefresh = () => {
    setRefreshing(true);
    fetchMatchHistory();
  };

  const handleQuickMatch = async () => {
    const stakeAmount = parseInt(stake) || 100;

    // Validate stake
    if (stakeAmount < 10) {
      Alert.alert('Invalid Stake', 'Minimum stake is 10 gold');
      return;
    }

    if (stakeAmount > (user?.gold_balance || 0)) {
      Alert.alert(
        'Insufficient Gold',
        `You need ${stakeAmount.toLocaleString()} gold but only have ${(
          user?.gold_balance || 0
        ).toLocaleString()}.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Go to Shop',
            onPress: () => {
              setShowStakeModal(false);
              router.push('/(tabs)/shop');
            },
          },
        ]
      );
      return;
    }

    setSearching(true);
    setShowStakeModal(false);

    try {
      const { data } = await matchmakingApi.joinQueue(stakeAmount);

      if (data.matched && data.match_id) {
        // Immediate match found
        setSearching(false);
        router.push(`/match/${data.match_id}`);
      } else {
        // Added to queue
        setQueuePosition(data.queue_position || 1);
        // Match will be found via WebSocket event
      }
    } catch (error: any) {
      setSearching(false);
      const message = error.response?.data?.error || 'Failed to join matchmaking queue';
      Alert.alert('Error', message);
    }
  };

  const handleCancelSearch = async () => {
    try {
      await matchmakingApi.leaveQueue();
    } catch (error) {
      console.error('Failed to leave queue:', error);
    } finally {
      setSearching(false);
      setQueuePosition(null);
    }
  };

  const handlePractice = () => {
    Alert.alert(
      '🤖 Practice Mode',
      'Play against our AI opponent to improve your skills!\n\nThis feature is coming soon in a future update.',
      [{ text: 'OK', style: 'default' }]
    );
  };

  const handlePrivateMatch = () => {
    Alert.alert(
      '👥 Private Match',
      'Challenge your friends to a private match!\n\nThis feature is coming soon in a future update.',
      [{ text: 'OK', style: 'default' }]
    );
  };

  const handleMatchPress = (match: RecentMatch) => {
    if (match.status === 'in_progress' || match.status === 'ready') {
      router.push(`/match/${match.match_id}`);
    } else {
      // Show match details for completed matches
      Alert.alert(
        match.result === 'win' ? '🏆 Victory!' : '😔 Defeat',
        `vs ${match.opponent_username}\nStake: ${match.stake_amount.toLocaleString()} gold\n${
          match.result === 'win'
            ? `Won: +${match.gold_change.toLocaleString()} gold`
            : `Lost: ${match.gold_change.toLocaleString()} gold`
        }\nPlayed: ${new Date(match.created_at).toLocaleDateString()}`,
        [{ text: 'OK' }]
      );
    }
  };

  const getResultStyle = (result: string) => {
    switch (result) {
      case 'win':
        return { bg: '#D1FAE5', text: '#059669', label: 'WIN' };
      case 'loss':
        return { bg: '#FEE2E2', text: '#DC2626', label: 'LOSS' };
      case 'ongoing':
        return { bg: '#DBEAFE', text: '#2563EB', label: 'ONGOING' };
      default:
        return { bg: '#F3F4F6', text: '#6B7280', label: 'DRAW' };
    }
  };

  // ==================== RENDER ====================
  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#667eea"
          />
        }
      >
        {/* ==================== WELCOME CARD ==================== */}
        <View style={styles.welcomeCard}>
          <View style={styles.welcomeTop}>
            <View>
              <Text style={styles.welcomeText}>Welcome back,</Text>
              <Text style={styles.username}>{user?.username || 'Player'}!</Text>
            </View>
            <View style={styles.goldBadge}>
              <Text style={styles.goldText}>🪙 {(user?.gold_balance || 0).toLocaleString()}</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{user?.level || 1}</Text>
              <Text style={styles.statLabel}>Level</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#10B981' }]}>{user?.wins || 0}</Text>
              <Text style={styles.statLabel}>Wins</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{user?.total_matches || 0}</Text>
              <Text style={styles.statLabel}>Matches</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#F59E0B' }]}>
                {user?.total_matches ? Math.round((user.wins / user.total_matches) * 100) : 0}%
              </Text>
              <Text style={styles.statLabel}>Win Rate</Text>
            </View>
          </View>
        </View>

        {/* ==================== QUICK MATCH BUTTON ==================== */}
        {searching ? (
          <View style={styles.searchingCard}>
            <ActivityIndicator size="large" color="#667eea" />
            <Text style={styles.searchingTitle}>Searching for opponent...</Text>
            {queuePosition && (
              <Text style={styles.searchingSubtitle}>Queue position: #{queuePosition}</Text>
            )}
            <TouchableOpacity style={styles.cancelSearchButton} onPress={handleCancelSearch}>
              <Text style={styles.cancelSearchText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.quickMatchButton}
            onPress={() => setShowStakeModal(true)}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.quickMatchGradient}
            >
              <View style={styles.quickMatchContent}>
                <Ionicons name="flash" size={32} color="white" />
                <View style={styles.quickMatchText}>
                  <Text style={styles.quickMatchTitle}>Quick Match</Text>
                  <Text style={styles.quickMatchSubtitle}>Find an opponent now</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={24} color="rgba(255,255,255,0.7)" />
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* ==================== SECONDARY ACTIONS ==================== */}
        <View style={styles.secondaryActions}>
          <TouchableOpacity style={styles.secondaryButton} onPress={handlePractice}>
            <View style={[styles.secondaryIcon, { backgroundColor: '#D1FAE5' }]}>
              <Ionicons name="game-controller" size={24} color="#059669" />
            </View>
            <Text style={styles.secondaryTitle}>Practice</Text>
            <Text style={styles.secondarySubtitle}>Play vs AI</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={handlePrivateMatch}>
            <View style={[styles.secondaryIcon, { backgroundColor: '#DBEAFE' }]}>
              <Ionicons name="people" size={24} color="#2563EB" />
            </View>
            <Text style={styles.secondaryTitle}>Private Match</Text>
            <Text style={styles.secondarySubtitle}>Invite a friend</Text>
          </TouchableOpacity>
        </View>

        {/* ==================== RECENT MATCHES ==================== */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Matches</Text>
            {recentMatches.length > 0 && (
              <TouchableOpacity onPress={() => Alert.alert('Coming Soon', 'Full match history coming soon!')}>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            )}
          </View>

          {loading ? (
            <View style={styles.loadingMatches}>
              <ActivityIndicator color="#667eea" />
              <Text style={styles.loadingText}>Loading matches...</Text>
            </View>
          ) : recentMatches.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="game-controller-outline" size={48} color="#D1D5DB" />
              </View>
              <Text style={styles.emptyTitle}>No matches yet</Text>
              <Text style={styles.emptySubtitle}>
                Play your first game to see your match history!
              </Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => setShowStakeModal(true)}
              >
                <Text style={styles.emptyButtonText}>Find a Match</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.matchList}>
              {recentMatches.map((match) => {
                const resultStyle = getResultStyle(match.result);
                return (
                  <TouchableOpacity
                    key={match.match_id}
                    style={styles.matchCard}
                    onPress={() => handleMatchPress(match)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.matchLeft}>
                      <View style={styles.matchAvatar}>
                        <Text style={styles.matchAvatarText}>
                          {match.opponent_username.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.matchInfo}>
                        <Text style={styles.matchOpponent}>vs {match.opponent_username}</Text>
                        <Text style={styles.matchDetails}>
                          {match.stake_amount.toLocaleString()} gold • {match.your_color}
                        </Text>
                        <Text style={styles.matchDate}>
                          {new Date(match.created_at).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.matchRight}>
                      <View
                        style={[styles.resultBadge, { backgroundColor: resultStyle.bg }]}
                      >
                        <Text style={[styles.resultText, { color: resultStyle.text }]}>
                          {resultStyle.label}
                        </Text>
                      </View>
                      {match.result !== 'ongoing' && (
                        <Text
                          style={[
                            styles.goldChange,
                            { color: match.gold_change >= 0 ? '#059669' : '#DC2626' },
                          ]}
                        >
                          {match.gold_change >= 0 ? '+' : ''}
                          {match.gold_change.toLocaleString()} 🪙
                        </Text>
                      )}
                      {match.result === 'ongoing' && (
                        <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ==================== STAKE SELECTION MODAL ==================== */}
      <Modal
        visible={showStakeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowStakeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>⚡ Quick Match</Text>
              <TouchableOpacity onPress={() => setShowStakeModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>Choose your stake amount</Text>

            {/* Quick Select Options */}
            <View style={styles.stakeOptions}>
              {[100, 500, 1000, 5000].map((amount) => (
                <TouchableOpacity
                  key={amount}
                  style={[
                    styles.stakeOption,
                    stake === String(amount) && styles.stakeOptionSelected,
                  ]}
                  onPress={() => setStake(String(amount))}
                >
                  <Text
                    style={[
                      styles.stakeOptionText,
                      stake === String(amount) && styles.stakeOptionTextSelected,
                    ]}
                  >
                    🪙 {amount.toLocaleString()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Custom Input */}
            <View style={styles.customStakeContainer}>
              <Text style={styles.customStakeLabel}>Or enter custom amount:</Text>
              <TextInput
                style={styles.stakeInput}
                placeholder="Enter amount"
                placeholderTextColor="#9CA3AF"
                value={stake}
                onChangeText={(text) => setStake(text.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                maxLength={7}
              />
            </View>

            {/* Balance Info */}
            <View style={styles.balanceInfo}>
              <Text style={styles.balanceLabel}>Your balance:</Text>
              <Text style={styles.balanceValue}>
                🪙 {(user?.gold_balance || 0).toLocaleString()}
              </Text>
            </View>

            {/* Warning if insufficient */}
            {parseInt(stake) > (user?.gold_balance || 0) && (
              <View style={styles.warningBox}>
                <Ionicons name="warning" size={18} color="#DC2626" />
                <Text style={styles.warningText}>Insufficient gold for this stake</Text>
              </View>
            )}

            {/* Find Match Button */}
            <TouchableOpacity
              style={[
                styles.findMatchButton,
                parseInt(stake) > (user?.gold_balance || 0) && styles.findMatchButtonDisabled,
              ]}
              onPress={handleQuickMatch}
              disabled={parseInt(stake) > (user?.gold_balance || 0)}
            >
              <Ionicons name="search" size={20} color="white" />
              <Text style={styles.findMatchButtonText}>Find Match</Text>
            </TouchableOpacity>

            {/* Shop Link */}
            <TouchableOpacity
              style={styles.shopLink}
              onPress={() => {
                setShowStakeModal(false);
                router.push('/(tabs)/shop');
              }}
            >
              <Text style={styles.shopLinkText}>Need more gold? Visit Shop</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ==================== STYLES ====================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  scrollContent: {
    paddingBottom: 20,
  },

  // Welcome Card
  welcomeCard: {
    backgroundColor: 'white',
    margin: 16,
    padding: 20,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  welcomeTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  welcomeText: {
    fontSize: 14,
    color: '#6B7280',
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 2,
  },
  goldBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  goldText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#D97706',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#E5E7EB',
  },
  statValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#667eea',
  },
  statLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
  },

  // Quick Match
  quickMatchButton: {
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  quickMatchGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  quickMatchContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  quickMatchText: {},
  quickMatchTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
  },
  quickMatchSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },

  // Searching Card
  searchingCard: {
    marginHorizontal: 16,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  searchingTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 16,
  },
  searchingSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  cancelSearchButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#FEE2E2',
    borderRadius: 20,
  },
  cancelSearchText: {
    color: '#DC2626',
    fontWeight: '600',
  },

  // Secondary Actions
  secondaryActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 16,
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  secondaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  secondaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  secondarySubtitle: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },

  // Section
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  seeAllText: {
    fontSize: 14,
    color: '#667eea',
    fontWeight: '600',
  },

  // Loading
  loadingMatches: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
  },

  // Empty State
  emptyState: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
  },
  emptyButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    marginTop: 20,
  },
  emptyButtonText: {
    color: 'white',
    fontWeight: '600',
  },

  // Match List
  matchList: {
    gap: 10,
  },
  matchCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  matchLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  matchAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
  },
  matchAvatarText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  matchInfo: {
    marginLeft: 12,
    flex: 1,
  },
  matchOpponent: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  matchDetails: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  matchDate: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  matchRight: {
    alignItems: 'flex-end',
  },
  resultBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  resultText: {
    fontSize: 11,
    fontWeight: '700',
  },
  goldChange: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
  },
  stakeOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  stakeOption: {
    flex: 1,
    minWidth: '45%',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  stakeOptionSelected: {
    borderColor: '#667eea',
    backgroundColor: '#EEF2FF',
  },
  stakeOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  stakeOptionTextSelected: {
    color: '#667eea',
  },
  customStakeContainer: {
    marginTop: 20,
  },
  customStakeLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 8,
  },
  stakeInput: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
  },
  balanceInfo: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    gap: 8,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  balanceValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F59E0B',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEE2E2',
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
  },
  warningText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '500',
  },
  findMatchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#667eea',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 20,
  },
  findMatchButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  findMatchButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  shopLink: {
    alignItems: 'center',
    marginTop: 16,
  },
  shopLinkText: {
    color: '#667eea',
    fontSize: 14,
    fontWeight: '500',
  },
});
```

---

## PHASE 2: Verify API Imports

### Step 2.1: Ensure matchApi has getHistory

Check `services/api/matchApi.ts` has:

```typescript
getHistory: (limit?: number) =>
  apiClient.get<{ success: boolean; matches: any[] }>('/matches/user/history', {
    params: { limit },
  }),
```

### Step 2.2: Ensure matchmakingApi exists

Check `services/api/matchmakingApi.ts` has:

```typescript
joinQueue: (stakeAmount: number, matchType?: 'gold' | 'club', clubId?: string) =>
  apiClient.post<{
    success: boolean;
    matched: boolean;
    match_id?: string;
    opponent?: { user_id: string; username: string; level: number; wins: number };
    queue_position?: number;
    estimated_wait?: number;
  }>('/matchmaking/join', {
    stake_amount: stakeAmount,
    match_type: matchType,
    club_id: clubId,
  }),

leaveQueue: () =>
  apiClient.post<{ success: boolean; cancelled: boolean }>('/matchmaking/leave'),
```

### Step 2.3: Ensure wsService has event subscription

Check `services/websocket.ts` has an `on` method for subscribing to events.

---

## ✅ LANE 10 VERIFICATION CHECKLIST

After implementing, verify:

- [ ] Play tab loads without errors
- [ ] Welcome card shows correct username and stats
- [ ] Quick Match button opens stake modal
- [ ] Stake options (100, 500, 1000, 5000) are selectable
- [ ] Custom stake input works
- [ ] Insufficient gold warning shows when appropriate
- [ ] "Find Match" button joins queue
- [ ] Cancel search button works
- [ ] Match history loads from API (or shows empty state)
- [ ] Recent matches display opponent name, result, gold change
- [ ] Clicking ongoing match navigates to match screen
- [ ] Practice button shows "Coming Soon" alert
- [ ] Private Match button shows "Coming Soon" alert
- [ ] Pull-to-refresh updates match history

---

## 📁 FILES CREATED/MODIFIED

| File | Action |
|------|--------|
| `app/(tabs)/index.tsx` | REPLACE |
| `services/api/matchApi.ts` | VERIFY |
| `services/api/matchmakingApi.ts` | VERIFY |
| `services/websocket.ts` | VERIFY |

---

## 🚀 READY FOR LANE 11

After Lane 10 is complete:
- Play tab shows real match history
- Quick Match flow works end-to-end
- Searching state with cancel works
- Practice/Private buttons show coming soon

Proceed to **Lane 11: Club Chat**
