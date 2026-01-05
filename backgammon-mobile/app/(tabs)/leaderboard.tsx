import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { leaderboardApi, LeaderboardEntry } from '../../services/api/leaderboardApi';

type SortType = 'wins' | 'level' | 'gold' | 'win_rate';

export default function LeaderboardTab() {
  const user = useAuthStore((state) => state.user);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<SortType>('wins');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLeaderboard = async () => {
    try {
      const [globalRes, rankRes] = await Promise.all([
        leaderboardApi.getGlobal(sortBy, 100),
        leaderboardApi.getMyRank(),
      ]);
      setLeaderboard(globalRes.data.leaderboard);
      setMyRank(rankRes.data.rank);
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchLeaderboard();
  }, [sortBy]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchLeaderboard();
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return '#FFD700';
    if (rank === 2) return '#C0C0C0';
    if (rank === 3) return '#CD7F32';
    return '#666';
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  const renderItem = ({ item }: { item: LeaderboardEntry }) => {
    const isMe = item.user_id === user?.user_id;

    return (
      <View style={[styles.row, isMe && styles.rowHighlight]}>
        <Text style={[styles.rank, { color: getRankColor(item.rank) }]}>
          {getRankIcon(item.rank)}
        </Text>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {item.username.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.info}>
          <Text style={[styles.username, isMe && styles.usernameMe]}>
            {item.username} {isMe && '(You)'}
          </Text>
          <Text style={styles.stats}>
            Level {item.level} • {item.win_rate}% win rate
          </Text>
        </View>
        <View style={styles.score}>
          <Text style={styles.scoreValue}>
            {sortBy === 'wins' && item.wins}
            {sortBy === 'level' && item.level}
            {sortBy === 'gold' && `${(item.gold_balance / 1000).toFixed(0)}K`}
            {sortBy === 'win_rate' && `${item.win_rate}%`}
          </Text>
          <Text style={styles.scoreLabel}>
            {sortBy === 'wins' && 'wins'}
            {sortBy === 'level' && 'level'}
            {sortBy === 'gold' && 'gold'}
            {sortBy === 'win_rate' && 'rate'}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* My Rank Card */}
      {myRank && (
        <View style={styles.myRankCard}>
          <Text style={styles.myRankLabel}>Your Rank</Text>
          <Text style={styles.myRankValue}>#{myRank}</Text>
        </View>
      )}

      {/* Sort Tabs */}
      <View style={styles.sortTabs}>
        {(['wins', 'level', 'gold', 'win_rate'] as SortType[]).map((type) => (
          <TouchableOpacity
            key={type}
            style={[styles.sortTab, sortBy === type && styles.sortTabActive]}
            onPress={() => setSortBy(type)}
          >
            <Text style={[styles.sortTabText, sortBy === type && styles.sortTabTextActive]}>
              {type === 'win_rate' ? 'Win %' : type.charAt(0).toUpperCase() + type.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Leaderboard List */}
      <FlatList
        data={leaderboard}
        keyExtractor={(item) => item.user_id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="trophy-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>No rankings yet</Text>
            <Text style={styles.emptySubtext}>Play some matches to appear here!</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  myRankCard: {
    backgroundColor: '#667eea',
    margin: 16,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  myRankLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  myRankValue: { color: 'white', fontSize: 36, fontWeight: 'bold', marginTop: 4 },
  sortTabs: {
    flexDirection: 'row',
    backgroundColor: 'white',
    marginHorizontal: 16,
    borderRadius: 8,
    padding: 4,
  },
  sortTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 6 },
  sortTabActive: { backgroundColor: '#667eea' },
  sortTabText: { fontSize: 12, fontWeight: '600', color: '#666' },
  sortTabTextActive: { color: 'white' },
  list: { padding: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  rowHighlight: { backgroundColor: '#EEF2FF', borderWidth: 1, borderColor: '#667eea' },
  rank: { width: 40, fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  info: { flex: 1 },
  username: { fontSize: 14, fontWeight: '600', color: '#333' },
  usernameMe: { color: '#667eea' },
  stats: { fontSize: 11, color: '#666', marginTop: 2 },
  score: { alignItems: 'flex-end' },
  scoreValue: { fontSize: 18, fontWeight: 'bold', color: '#667eea' },
  scoreLabel: { fontSize: 10, color: '#999' },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 16, color: '#666', marginTop: 12 },
  emptySubtext: { fontSize: 12, color: '#999', marginTop: 4 },
});
