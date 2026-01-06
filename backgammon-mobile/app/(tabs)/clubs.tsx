import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import debounce from 'lodash/debounce';
import { useClubStore } from '../../store/clubStore';
import { Club, ClubWithMembership } from '../../types/club.types';

type TabType = 'my' | 'discover';

export default function ClubsTab() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('my');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const {
    myClubs,
    myClubsLoading,
    discoveredClubs,
    discoveryLoading,
    fetchMyClubs,
    searchClubs,
  } = useClubStore();

  useEffect(() => {
    fetchMyClubs();
    searchClubs();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchMyClubs(), searchClubs(searchQuery)]);
    setRefreshing(false);
  };

  // Create debounced search function
  const debouncedSearch = useCallback(
    debounce((text: string) => {
      if (text.trim()) {
        searchClubs(text);
      } else {
        // Clear search results or fetch all clubs
        searchClubs();
      }
    }, 400),
    []
  );

  // Update handleSearch to use debounce
  const handleSearch = (text: string) => {
    setSearchQuery(text);
    debouncedSearch(text);
  };

  const renderMyClubItem = ({ item }: { item: ClubWithMembership }) => (
    <TouchableOpacity
      style={styles.clubCard}
      onPress={() => router.push(`/club/${item.club_id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.clubIcon}>
        <Text style={styles.clubIconText}>
          {item.name.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.clubInfo}>
        <Text style={styles.clubName}>{item.name}</Text>
        <Text style={styles.clubMeta}>
          {item.member_count} members • {item.role}
        </Text>
      </View>
      <View style={styles.chipBalance}>
        <Text style={styles.chipIcon}>🎰</Text>
        <Text style={styles.chipAmount}>{item.chip_balance.toLocaleString()}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderDiscoverClubItem = ({ item }: { item: Club }) => (
    <TouchableOpacity
      style={styles.clubCard}
      onPress={() => router.push(`/club/${item.club_id}`)}
      activeOpacity={0.7}
    >
      <View style={[styles.clubIcon, { backgroundColor: '#10B981' }]}>
        <Text style={styles.clubIconText}>
          {item.name.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.clubInfo}>
        <Text style={styles.clubName}>{item.name}</Text>
        <Text style={styles.clubMeta}>
          {item.member_count} members • {item.privacy === 'private' ? '🔒 Private' : 'Public'}
        </Text>
        {item.welcome_bonus > 0 && (
          <Text style={styles.welcomeBonus}>
            🎁 {item.welcome_bonus.toLocaleString()} chips welcome bonus!
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color="#ccc" />
    </TouchableOpacity>
  );

  const isLoading = activeTab === 'my' ? myClubsLoading : discoveryLoading;
  const data = activeTab === 'my' ? myClubs : discoveredClubs;

  return (
    <View style={styles.container}>
      {/* Tab Switcher */}
      <View style={styles.tabSwitcher}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'my' && styles.tabActive]}
          onPress={() => setActiveTab('my')}
        >
          <Text style={[styles.tabText, activeTab === 'my' && styles.tabTextActive]}>
            My Clubs
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'discover' && styles.tabActive]}
          onPress={() => setActiveTab('discover')}
        >
          <Text style={[styles.tabText, activeTab === 'discover' && styles.tabTextActive]}>
            Discover
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search (only for discover) */}
      {activeTab === 'discover' && (
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search clubs..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={handleSearch}
          />
        </View>
      )}

      {/* List */}
      {isLoading && data.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
        </View>
      ) : data.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>
            {activeTab === 'my' ? '👥' : searchQuery.trim() ? '🔍' : '🏠'}
          </Text>
          <Text style={styles.emptyTitle}>
            {activeTab === 'my'
              ? 'No Clubs Yet'
              : searchQuery.trim()
              ? `No clubs matching "${searchQuery}"` : 'No Clubs Found'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {activeTab === 'my'
              ? 'Join or create a club to get started!'
              : searchQuery.trim()
              ? 'Try a different search term'
              : 'Be the first to create a club!'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.club_id}
          renderItem={activeTab === 'my' ? renderMyClubItem : renderDiscoverClubItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        />
      )}

      {/* Create Club FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/club/create')}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: { backgroundColor: '#667eea' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#666' },
  tabTextActive: { color: 'white' },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 12,
  },
  searchInput: { flex: 1, paddingVertical: 14, fontSize: 16, color: '#333' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: '#666', marginTop: 8, textAlign: 'center' },
  listContent: { padding: 16, paddingTop: 0 },
  clubCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  clubIcon: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clubIconText: { fontSize: 20, fontWeight: 'bold', color: 'white' },
  clubInfo: { flex: 1, marginLeft: 12 },
  clubName: { fontSize: 16, fontWeight: '600', color: '#333' },
  clubMeta: { fontSize: 12, color: '#666', marginTop: 4 },
  welcomeBonus: { fontSize: 11, color: '#10B981', marginTop: 4 },
  chipBalance: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chipIcon: { fontSize: 16 },
  chipAmount: { fontSize: 14, fontWeight: 'bold', color: '#667eea' },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
});
