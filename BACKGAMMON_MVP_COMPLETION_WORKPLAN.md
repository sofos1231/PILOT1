# 🎯 BACKGAMMON MVP COMPLETION WORK PLAN
## From 52.6% → 100% Complete
## 8 Lanes to Full MVP

---

# CURRENT STATE

| Metric | Value |
|--------|-------|
| Current Completion | 52.6% |
| Fully Working Features | 10/19 |
| Broken/Unwired Features | 9/19 |
| Estimated Work Remaining | 6-8 hours |

---

# LANE OVERVIEW

| Lane | Focus | Features | Time Est. |
|------|-------|----------|-----------|
| Lane 8 | Gold & Shop System | 4 features | 45 min |
| Lane 9 | Profile & User Data | 2 features | 30 min |
| Lane 10 | Play Tab Completion | 3 features | 45 min |
| Lane 11 | Club Chat | 1 feature | 30 min |
| Lane 12 | Club Tables & Games | 2 features | 45 min |
| Lane 13 | Polish & Error Handling | 4 features | 45 min |
| Lane 14 | Testing & Bug Fixes | All features | 60 min |
| Lane 15 | Final Integration | Full app | 30 min |

**Total Estimated Time: 6-7 hours**

---

# EXECUTION ORDER

```
Lane 8 (Gold)     ─────► Lane 9 (Profile) ─────► Lane 10 (Play Tab)
                                                        │
Lane 11 (Chat)    ◄─────────────────────────────────────┘
        │
        ▼
Lane 12 (Tables)  ─────► Lane 13 (Polish) ─────► Lane 14 (Testing)
                                                        │
                                                        ▼
                                                 Lane 15 (Final)
```

**Lanes 8-10** can run sequentially (same developer)
**Lane 11-12** can run after Lane 10
**Lanes 13-15** must be last and sequential

---

# LANE 8: GOLD & SHOP SYSTEM
## Priority: CRITICAL
## Time: 45 minutes

### Problem
- `goldApi.ts` does not exist in frontend
- `shop.tsx` is a placeholder saying "Coming in Lane 5"
- 6 backend endpoints have zero frontend integration
- Daily bonus cannot be claimed
- Users cannot see gold packages or buy gold

### Files to Create/Modify

**CREATE: `services/api/goldApi.ts`**
```typescript
import apiClient from './axiosInstance';

export interface GoldPackage {
  id: string;
  name: string;
  gold_amount: number;
  price_usd: number;
  bonus_percent: number;
}

export interface GoldTransaction {
  transaction_id: string;
  type: string;
  amount: number;
  balance_after: number;
  description: string;
  created_at: string;
}

export const goldApi = {
  getBalance: () => 
    apiClient.get<{ success: boolean; balance: number }>('/gold/balance'),

  getPackages: () =>
    apiClient.get<{ success: boolean; packages: GoldPackage[] }>('/gold/packages'),

  getTransactions: (limit?: number) =>
    apiClient.get<{ success: boolean; transactions: GoldTransaction[] }>(
      '/gold/transactions',
      { params: { limit } }
    ),

  claimDailyBonus: () =>
    apiClient.post<{ 
      success: boolean; 
      amount: number; 
      new_balance: number;
      next_claim_at: string;
    }>('/gold/daily-bonus/claim'),

  createPurchaseIntent: (packageId: string) =>
    apiClient.post<{ 
      success: boolean; 
      client_secret: string;
      amount: number;
    }>('/gold/purchase/intent', { package_id: packageId }),

  confirmPurchase: (paymentIntentId: string) =>
    apiClient.post<{ 
      success: boolean; 
      gold_added: number;
      new_balance: number;
    }>('/gold/purchase/confirm', { payment_intent_id: paymentIntentId }),
};
```

**REWRITE: `app/(tabs)/shop.tsx`**
```typescript
import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { goldApi, GoldPackage } from '../../services/api/goldApi';
import { useAuthStore } from '../../store/authStore';

export default function ShopTab() {
  const user = useAuthStore((state) => state.user);
  const updateGoldBalance = useAuthStore((state) => state.updateGoldBalance);
  
  const [packages, setPackages] = useState<GoldPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [claimingBonus, setClaimingBonus] = useState(false);
  const [canClaimBonus, setCanClaimBonus] = useState(true);

  const fetchPackages = async () => {
    try {
      const { data } = await goldApi.getPackages();
      setPackages(data.packages);
    } catch (error) {
      console.error('Failed to fetch packages:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPackages();
  }, []);

  const handleClaimDailyBonus = async () => {
    setClaimingBonus(true);
    try {
      const { data } = await goldApi.claimDailyBonus();
      updateGoldBalance(data.new_balance);
      setCanClaimBonus(false);
      Alert.alert('🎁 Daily Bonus!', `You received ${data.amount} gold!`);
    } catch (error: any) {
      const message = error.response?.data?.error || 'Failed to claim bonus';
      if (message.includes('already claimed')) {
        setCanClaimBonus(false);
      }
      Alert.alert('Oops', message);
    } finally {
      setClaimingBonus(false);
    }
  };

  const handlePurchase = async (pkg: GoldPackage) => {
    Alert.alert(
      'Purchase Gold',
      `Buy ${pkg.gold_amount.toLocaleString()} gold for $${pkg.price_usd.toFixed(2)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Buy',
          onPress: async () => {
            try {
              // In production, this would open Stripe checkout
              Alert.alert(
                'Payment',
                'Stripe integration required for real purchases. This is a demo.',
                [{ text: 'OK' }]
              );
            } catch (error) {
              Alert.alert('Error', 'Purchase failed');
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
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => {
          setRefreshing(true);
          fetchPackages();
        }} />
      }
    >
      {/* Current Balance */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Your Gold</Text>
        <Text style={styles.balanceValue}>🪙 {(user?.gold_balance || 0).toLocaleString()}</Text>
      </View>

      {/* Daily Bonus */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🎁 Daily Bonus</Text>
        <TouchableOpacity
          style={[styles.bonusButton, !canClaimBonus && styles.bonusButtonDisabled]}
          onPress={handleClaimDailyBonus}
          disabled={!canClaimBonus || claimingBonus}
        >
          {claimingBonus ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Ionicons name="gift" size={24} color="white" />
              <Text style={styles.bonusButtonText}>
                {canClaimBonus ? 'Claim 500 Gold' : 'Already Claimed Today'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Gold Packages */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>💰 Gold Packages</Text>
        {packages.map((pkg) => (
          <TouchableOpacity
            key={pkg.id}
            style={styles.packageCard}
            onPress={() => handlePurchase(pkg)}
          >
            <View style={styles.packageInfo}>
              <Text style={styles.packageName}>{pkg.name}</Text>
              <Text style={styles.packageGold}>🪙 {pkg.gold_amount.toLocaleString()}</Text>
              {pkg.bonus_percent > 0 && (
                <Text style={styles.packageBonus}>+{pkg.bonus_percent}% bonus!</Text>
              )}
            </View>
            <View style={styles.packagePrice}>
              <Text style={styles.priceText}>${pkg.price_usd.toFixed(2)}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  balanceCard: {
    backgroundColor: '#667eea',
    margin: 16,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
  },
  balanceLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  balanceValue: { color: 'white', fontSize: 36, fontWeight: 'bold', marginTop: 4 },
  section: { padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12, color: '#333' },
  bonusButton: {
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  bonusButtonDisabled: { backgroundColor: '#9CA3AF' },
  bonusButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  packageCard: {
    backgroundColor: 'white',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  packageInfo: { flex: 1 },
  packageName: { fontSize: 16, fontWeight: '600', color: '#333' },
  packageGold: { fontSize: 20, fontWeight: 'bold', color: '#F59E0B', marginTop: 4 },
  packageBonus: { fontSize: 12, color: '#10B981', marginTop: 2 },
  packagePrice: {
    backgroundColor: '#667eea',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  priceText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
});
```

### Verification Checklist
- [ ] goldApi.ts exists in services/api/
- [ ] shop.tsx imports goldApi
- [ ] Daily bonus button calls claimDailyBonus()
- [ ] Gold packages load from API
- [ ] Balance displays correctly
- [ ] Pull-to-refresh works

---

# LANE 9: PROFILE & USER DATA
## Priority: HIGH
## Time: 30 minutes

### Problem
- Profile shows stale data (0 gold, "Player" name)
- `authApi.getProfile()` exists but is never called
- No way to refresh user data
- WebSocket gold updates may not reflect in store

### Files to Modify

**UPDATE: `app/(tabs)/profile.tsx`**
```typescript
import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { authApi } from '../../services/api/authApi';

export default function ProfileTab() {
  const router = useRouter();
  const { user, setUser, logout } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    try {
      const { data } = await authApi.getProfile();
      if (data.success && data.user) {
        setUser(data.user);
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [setUser]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchProfile();
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            await logout();
            router.replace('/(auth)/welcome');
          } catch (error) {
            Alert.alert('Error', 'Failed to logout');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      {/* Avatar */}
      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.username?.charAt(0).toUpperCase() || '?'}
          </Text>
        </View>
        <Text style={styles.username}>{user?.username || 'Unknown'}</Text>
        <Text style={styles.email}>{user?.email || ''}</Text>
      </View>

      {/* Stats Card */}
      <View style={styles.statsCard}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>🪙 {(user?.gold_balance || 0).toLocaleString()}</Text>
          <Text style={styles.statLabel}>Gold</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{user?.level || 1}</Text>
          <Text style={styles.statLabel}>Level</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{user?.xp || 0}</Text>
          <Text style={styles.statLabel}>XP</Text>
        </View>
      </View>

      {/* Game Stats */}
      <View style={styles.gameStatsCard}>
        <Text style={styles.cardTitle}>Game Statistics</Text>
        <View style={styles.gameStatsRow}>
          <View style={styles.gameStatItem}>
            <Text style={styles.gameStatValue}>{user?.total_matches || 0}</Text>
            <Text style={styles.gameStatLabel}>Matches</Text>
          </View>
          <View style={styles.gameStatItem}>
            <Text style={[styles.gameStatValue, { color: '#10B981' }]}>{user?.wins || 0}</Text>
            <Text style={styles.gameStatLabel}>Wins</Text>
          </View>
          <View style={styles.gameStatItem}>
            <Text style={[styles.gameStatValue, { color: '#EF4444' }]}>{user?.losses || 0}</Text>
            <Text style={styles.gameStatLabel}>Losses</Text>
          </View>
          <View style={styles.gameStatItem}>
            <Text style={styles.gameStatValue}>
              {user?.total_matches ? Math.round((user.wins / user.total_matches) * 100) : 0}%
            </Text>
            <Text style={styles.gameStatLabel}>Win Rate</Text>
          </View>
        </View>
      </View>

      {/* Gold Stats */}
      <View style={styles.goldStatsCard}>
        <Text style={styles.cardTitle}>Gold Statistics</Text>
        <View style={styles.goldStatRow}>
          <Text style={styles.goldStatLabel}>Total Earned</Text>
          <Text style={styles.goldStatValue}>🪙 {(user?.total_gold_earned || 0).toLocaleString()}</Text>
        </View>
        <View style={styles.goldStatRow}>
          <Text style={styles.goldStatLabel}>Total Spent</Text>
          <Text style={styles.goldStatValue}>🪙 {(user?.total_gold_spent || 0).toLocaleString()}</Text>
        </View>
      </View>

      {/* Account Info */}
      <View style={styles.infoCard}>
        <Text style={styles.cardTitle}>Account</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Country</Text>
          <Text style={styles.infoValue}>{user?.country || 'Not set'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Member Since</Text>
          <Text style={styles.infoValue}>
            {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}
          </Text>
        </View>
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={24} color="#EF4444" />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  avatarContainer: { alignItems: 'center', paddingVertical: 24 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: 'white', fontSize: 32, fontWeight: 'bold' },
  username: { fontSize: 24, fontWeight: 'bold', marginTop: 12, color: '#333' },
  email: { fontSize: 14, color: '#666', marginTop: 4 },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  statLabel: { fontSize: 12, color: '#666', marginTop: 4 },
  statDivider: { width: 1, backgroundColor: '#E5E7EB' },
  gameStatsCard: {
    backgroundColor: 'white',
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12, color: '#333' },
  gameStatsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  gameStatItem: { alignItems: 'center' },
  gameStatValue: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  gameStatLabel: { fontSize: 12, color: '#666', marginTop: 4 },
  goldStatsCard: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
  },
  goldStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  goldStatLabel: { fontSize: 14, color: '#666' },
  goldStatValue: { fontSize: 14, fontWeight: '600', color: '#333' },
  infoCard: {
    backgroundColor: 'white',
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  infoLabel: { fontSize: 14, color: '#666' },
  infoValue: { fontSize: 14, color: '#333' },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  logoutText: { fontSize: 16, color: '#EF4444', fontWeight: '600' },
});
```

**UPDATE: `store/authStore.ts`** - Ensure setUser is exported:
```typescript
// Add to the store interface and implementation if not present:
setUser: (user: User) => void;

// In the store:
setUser: (user) => set({ user }),
```

### Verification Checklist
- [ ] Profile loads real data on mount
- [ ] Gold balance shows correct amount
- [ ] Username displays correctly
- [ ] Pull-to-refresh updates data
- [ ] Game stats show real numbers

---

# LANE 10: PLAY TAB COMPLETION
## Priority: HIGH
## Time: 45 minutes

### Problem
- Match history says "No matches yet" (hardcoded)
- Practice button does nothing
- Private Match button does nothing
- matchApi.getHistory() never called

### Files to Modify

**UPDATE: `app/(tabs)/index.tsx`**
- Import matchApi
- Fetch match history on mount
- Display recent matches
- Wire Practice button (show coming soon)
- Wire Private Match button (show coming soon)

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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { matchApi } from '../../services/api/matchApi';
import { matchmakingApi } from '../../services/api/matchmakingApi';

interface RecentMatch {
  match_id: string;
  opponent_username: string;
  result: 'win' | 'loss';
  gold_change: number;
  created_at: string;
}

export default function PlayTab() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  
  const [recentMatches, setRecentMatches] = useState<RecentMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showStakeModal, setShowStakeModal] = useState(false);
  const [stake, setStake] = useState('100');
  const [searching, setSearching] = useState(false);

  const fetchMatchHistory = useCallback(async () => {
    try {
      const { data } = await matchApi.getHistory(5);
      if (data.success && data.matches) {
        const formatted = data.matches.map((match: any) => ({
          match_id: match.match_id,
          opponent_username: match.player_white_id === user?.user_id 
            ? match.player_black_username 
            : match.player_white_username,
          result: match.winner_id === user?.user_id ? 'win' : 'loss',
          gold_change: match.winner_id === user?.user_id 
            ? match.stake_amount 
            : -match.stake_amount,
          created_at: match.created_at,
        }));
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

  const handleRefresh = () => {
    setRefreshing(true);
    fetchMatchHistory();
  };

  const handleQuickMatch = async () => {
    const stakeAmount = parseInt(stake) || 100;

    if (stakeAmount > (user?.gold_balance || 0)) {
      Alert.alert('Insufficient Gold', "You don't have enough gold for this stake.");
      return;
    }

    setSearching(true);
    setShowStakeModal(false);

    try {
      const { data } = await matchmakingApi.joinQueue(stakeAmount);

      if (data.matched && data.match_id) {
        router.push(`/match/${data.match_id}`);
      } else {
        Alert.alert(
          'Searching for opponent...',
          `Position: #${data.queue_position}\nEstimated wait: ${data.estimated_wait}s`,
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: async () => {
                await matchmakingApi.leaveQueue();
                setSearching(false);
              },
            },
          ]
        );
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to join queue');
      setSearching(false);
    }
  };

  const handlePractice = () => {
    Alert.alert('Coming Soon', 'Practice mode with AI will be available in a future update!');
  };

  const handlePrivateMatch = () => {
    Alert.alert('Coming Soon', 'Private match invites will be available in a future update!');
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      {/* Welcome Card */}
      <View style={styles.welcomeCard}>
        <Text style={styles.welcomeText}>Welcome back,</Text>
        <Text style={styles.username}>{user?.username || 'Player'}!</Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{user?.level || 1}</Text>
            <Text style={styles.statLabel}>Level</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{user?.wins || 0}</Text>
            <Text style={styles.statLabel}>Wins</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{user?.total_matches || 0}</Text>
            <Text style={styles.statLabel}>Matches</Text>
          </View>
        </View>
      </View>

      {/* Quick Match Button */}
      <TouchableOpacity
        style={[styles.quickMatchButton, searching && styles.quickMatchButtonSearching]}
        onPress={() => setShowStakeModal(true)}
        disabled={searching}
      >
        {searching ? (
          <>
            <ActivityIndicator color="white" />
            <Text style={styles.quickMatchText}>Searching...</Text>
          </>
        ) : (
          <>
            <Ionicons name="flash" size={28} color="white" />
            <Text style={styles.quickMatchText}>Quick Match</Text>
            <Text style={styles.quickMatchSubtext}>Find an opponent now</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Secondary Actions */}
      <View style={styles.secondaryActions}>
        <TouchableOpacity style={styles.secondaryButton} onPress={handlePractice}>
          <Ionicons name="game-controller-outline" size={24} color="#667eea" />
          <Text style={styles.secondaryButtonText}>Practice</Text>
          <Text style={styles.secondaryButtonSubtext}>Play vs AI</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={handlePrivateMatch}>
          <Ionicons name="people-outline" size={24} color="#667eea" />
          <Text style={styles.secondaryButtonText}>Private Match</Text>
          <Text style={styles.secondaryButtonSubtext}>Invite a friend</Text>
        </TouchableOpacity>
      </View>

      {/* Recent Matches */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Matches</Text>
        {loading ? (
          <ActivityIndicator color="#667eea" style={{ padding: 20 }} />
        ) : recentMatches.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="game-controller-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>No matches yet</Text>
            <Text style={styles.emptySubtext}>Play your first game!</Text>
          </View>
        ) : (
          recentMatches.map((match) => (
            <TouchableOpacity
              key={match.match_id}
              style={styles.matchCard}
              onPress={() => router.push(`/match/${match.match_id}`)}
            >
              <View style={styles.matchInfo}>
                <Text style={styles.opponentName}>vs {match.opponent_username}</Text>
                <Text style={styles.matchDate}>
                  {new Date(match.created_at).toLocaleDateString()}
                </Text>
              </View>
              <View style={[
                styles.matchResult,
                match.result === 'win' ? styles.winResult : styles.lossResult
              ]}>
                <Text style={styles.resultText}>
                  {match.result === 'win' ? 'WIN' : 'LOSS'}
                </Text>
                <Text style={[
                  styles.goldChange,
                  match.gold_change > 0 ? styles.goldPositive : styles.goldNegative
                ]}>
                  {match.gold_change > 0 ? '+' : ''}{match.gold_change} 🪙
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Stake Selection Modal */}
      <Modal
        visible={showStakeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowStakeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Quick Match</Text>
            <Text style={styles.modalSubtitle}>Choose your stake amount</Text>

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
                    🪙 {amount}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.stakeInput}
              placeholder="Or enter custom amount"
              value={stake}
              onChangeText={setStake}
              keyboardType="number-pad"
            />

            <Text style={styles.balanceText}>
              Your balance: 🪙 {(user?.gold_balance || 0).toLocaleString()}
            </Text>

            <TouchableOpacity style={styles.findMatchButton} onPress={handleQuickMatch}>
              <Text style={styles.findMatchButtonText}>Find Match</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowStakeModal(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  welcomeCard: {
    backgroundColor: 'white',
    margin: 16,
    padding: 20,
    borderRadius: 16,
  },
  welcomeText: { fontSize: 14, color: '#666' },
  username: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  statsRow: { flexDirection: 'row', marginTop: 16, justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: 'bold', color: '#667eea' },
  statLabel: { fontSize: 12, color: '#666', marginTop: 4 },
  quickMatchButton: {
    backgroundColor: '#667eea',
    marginHorizontal: 16,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
  },
  quickMatchButtonSearching: { backgroundColor: '#9CA3AF' },
  quickMatchText: { color: 'white', fontSize: 22, fontWeight: 'bold', marginTop: 8 },
  quickMatchSubtext: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 4 },
  secondaryActions: { flexDirection: 'row', paddingHorizontal: 16, marginTop: 16, gap: 12 },
  secondaryButton: {
    flex: 1,
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryButtonText: { fontSize: 14, fontWeight: '600', color: '#333', marginTop: 8 },
  secondaryButtonSubtext: { fontSize: 11, color: '#666', marginTop: 2 },
  section: { padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12, color: '#333' },
  emptyState: { alignItems: 'center', padding: 32, backgroundColor: 'white', borderRadius: 12 },
  emptyText: { fontSize: 16, color: '#666', marginTop: 12 },
  emptySubtext: { fontSize: 12, color: '#999', marginTop: 4 },
  matchCard: {
    backgroundColor: 'white',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  matchInfo: { flex: 1 },
  opponentName: { fontSize: 16, fontWeight: '600', color: '#333' },
  matchDate: { fontSize: 12, color: '#666', marginTop: 4 },
  matchResult: { alignItems: 'flex-end', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  winResult: { backgroundColor: '#D1FAE5' },
  lossResult: { backgroundColor: '#FEE2E2' },
  resultText: { fontSize: 12, fontWeight: 'bold' },
  goldChange: { fontSize: 14, fontWeight: '600', marginTop: 2 },
  goldPositive: { color: '#10B981' },
  goldNegative: { color: '#EF4444' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 24, fontWeight: 'bold', textAlign: 'center' },
  modalSubtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginTop: 8, marginBottom: 24 },
  stakeOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  stakeOption: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8, borderWidth: 2, borderColor: '#ddd' },
  stakeOptionSelected: { borderColor: '#667eea', backgroundColor: '#EEF2FF' },
  stakeOptionText: { fontSize: 16, color: '#666' },
  stakeOptionTextSelected: { color: '#667eea', fontWeight: '600' },
  stakeInput: { backgroundColor: '#f5f5f5', padding: 16, borderRadius: 12, marginTop: 16, fontSize: 16, textAlign: 'center' },
  balanceText: { textAlign: 'center', marginTop: 12, color: '#666' },
  findMatchButton: { backgroundColor: '#667eea', padding: 18, borderRadius: 12, marginTop: 24 },
  findMatchButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
  cancelButton: { marginTop: 12, padding: 12 },
  cancelButtonText: { color: '#666', fontSize: 16, textAlign: 'center' },
});
```

### Verification Checklist
- [ ] Match history loads from API
- [ ] Recent matches display with opponent name
- [ ] Win/loss shows with gold change
- [ ] Practice button shows "Coming Soon" alert
- [ ] Private Match button shows "Coming Soon" alert
- [ ] Quick match modal works

---

# LANE 11: CLUB CHAT
## Priority: MEDIUM
## Time: 30 minutes

### Problem
- Club detail page says "Chat coming soon!"
- WebSocket chat is fully implemented on backend
- useClubSocket hook exists but not used
- clubsApi.getChatHistory() never called

### Files to Modify

**UPDATE: `app/club/[id].tsx`** - Add chat section

Add chat UI to the club detail screen with:
- Chat message list
- Text input for new messages
- useClubSocket hook integration
- Load chat history on mount
- Real-time message updates

```typescript
// Add these imports at the top
import { useClubSocket } from '../../hooks/useWebSocket';
import { clubsApi } from '../../services/api/clubsApi';

// Add state for chat
const [chatMessages, setChatMessages] = useState<any[]>([]);
const [chatInput, setChatInput] = useState('');
const [loadingChat, setLoadingChat] = useState(false);

// Use the club socket hook
const { sendMessage, messages: newMessages } = useClubSocket(id as string);

// Fetch chat history
const fetchChatHistory = async () => {
  setLoadingChat(true);
  try {
    const { data } = await clubsApi.getChatHistory(id as string, 50);
    if (data.success) {
      setChatMessages(data.messages || []);
    }
  } catch (error) {
    console.error('Failed to load chat:', error);
  } finally {
    setLoadingChat(false);
  }
};

// Load chat on mount
useEffect(() => {
  if (id) {
    fetchChatHistory();
  }
}, [id]);

// Update messages when new ones arrive via WebSocket
useEffect(() => {
  if (newMessages.length > 0) {
    setChatMessages(prev => [...prev, ...newMessages]);
  }
}, [newMessages]);

// Send message handler
const handleSendMessage = () => {
  if (!chatInput.trim()) return;
  sendMessage(chatInput.trim());
  setChatInput('');
};

// Add Chat UI section in the render (replace "Chat coming soon!")
<View style={styles.chatSection}>
  <Text style={styles.sectionTitle}>Club Chat</Text>
  <View style={styles.chatContainer}>
    <ScrollView style={styles.chatMessages}>
      {loadingChat ? (
        <ActivityIndicator color="#667eea" />
      ) : chatMessages.length === 0 ? (
        <Text style={styles.emptyChat}>No messages yet. Start the conversation!</Text>
      ) : (
        chatMessages.map((msg, index) => (
          <View key={msg.message_id || index} style={styles.chatMessage}>
            <Text style={styles.chatUsername}>{msg.username}</Text>
            <Text style={styles.chatText}>{msg.message}</Text>
          </View>
        ))
      )}
    </ScrollView>
    <View style={styles.chatInputContainer}>
      <TextInput
        style={styles.chatInput}
        placeholder="Type a message..."
        value={chatInput}
        onChangeText={setChatInput}
        onSubmitEditing={handleSendMessage}
      />
      <TouchableOpacity style={styles.sendButton} onPress={handleSendMessage}>
        <Ionicons name="send" size={20} color="white" />
      </TouchableOpacity>
    </View>
  </View>
</View>

// Add styles
chatSection: { padding: 16 },
chatContainer: { backgroundColor: 'white', borderRadius: 12, height: 300 },
chatMessages: { flex: 1, padding: 12 },
emptyChat: { textAlign: 'center', color: '#999', padding: 20 },
chatMessage: { marginBottom: 12 },
chatUsername: { fontSize: 12, fontWeight: '600', color: '#667eea' },
chatText: { fontSize: 14, color: '#333', marginTop: 2 },
chatInputContainer: { flexDirection: 'row', padding: 8, borderTopWidth: 1, borderTopColor: '#eee' },
chatInput: { flex: 1, backgroundColor: '#f5f5f5', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
sendButton: { backgroundColor: '#667eea', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
```

**UPDATE: `services/api/clubsApi.ts`** - Add getChatHistory if missing

```typescript
getChatHistory: (clubId: string, limit?: number) =>
  apiClient.get(`/clubs/${clubId}/chat`, { params: { limit } }),
```

### Verification Checklist
- [ ] Chat section visible in club detail
- [ ] Chat history loads on mount
- [ ] Can type and send messages
- [ ] Messages appear in real-time
- [ ] Other users see messages

---

# LANE 12: CLUB TABLES & GAMES
## Priority: MEDIUM
## Time: 45 minutes

### Problem
- Can't create tables in clubs
- clubsApi.createTable() exists but never called
- No UI to start matches at club tables

### Files to Create/Modify

**UPDATE: `app/club/[id].tsx`** - Add table creation UI

Add:
- "Create Table" button
- Table creation modal (stake amount)
- Join table functionality
- Display active tables

```typescript
// Add state
const [tables, setTables] = useState<any[]>([]);
const [showCreateTableModal, setShowCreateTableModal] = useState(false);
const [tableStake, setTableStake] = useState('100');
const [creatingTable, setCreatingTable] = useState(false);

// Fetch tables
const fetchTables = async () => {
  try {
    const { data } = await clubsApi.getTables(id as string);
    if (data.success) {
      setTables(data.tables || []);
    }
  } catch (error) {
    console.error('Failed to load tables:', error);
  }
};

// Create table handler
const handleCreateTable = async () => {
  const stake = parseInt(tableStake) || 100;
  setCreatingTable(true);
  try {
    const { data } = await clubsApi.createTable(id as string, stake);
    if (data.success) {
      setShowCreateTableModal(false);
      fetchTables();
      Alert.alert('Table Created', `Table with ${stake} chip stake created!`);
    }
  } catch (error: any) {
    Alert.alert('Error', error.response?.data?.error || 'Failed to create table');
  } finally {
    setCreatingTable(false);
  }
};

// Add Tables UI section
<View style={styles.tablesSection}>
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>Club Tables</Text>
    <TouchableOpacity 
      style={styles.createTableButton}
      onPress={() => setShowCreateTableModal(true)}
    >
      <Ionicons name="add" size={20} color="white" />
      <Text style={styles.createTableButtonText}>Create</Text>
    </TouchableOpacity>
  </View>
  
  {tables.length === 0 ? (
    <View style={styles.emptyTables}>
      <Text style={styles.emptyText}>No active tables</Text>
      <Text style={styles.emptySubtext}>Create one to start playing!</Text>
    </View>
  ) : (
    tables.map((table) => (
      <View key={table.table_id} style={styles.tableCard}>
        <View>
          <Text style={styles.tableStake}>{table.stake_amount} chips</Text>
          <Text style={styles.tableStatus}>{table.status}</Text>
        </View>
        <TouchableOpacity style={styles.joinTableButton}>
          <Text style={styles.joinTableButtonText}>Join</Text>
        </TouchableOpacity>
      </View>
    ))
  )}
</View>

// Create Table Modal
<Modal
  visible={showCreateTableModal}
  transparent
  animationType="slide"
>
  <View style={styles.modalOverlay}>
    <View style={styles.modalContent}>
      <Text style={styles.modalTitle}>Create Table</Text>
      <TextInput
        style={styles.stakeInput}
        placeholder="Chip stake amount"
        value={tableStake}
        onChangeText={setTableStake}
        keyboardType="number-pad"
      />
      <TouchableOpacity 
        style={styles.createButton}
        onPress={handleCreateTable}
        disabled={creatingTable}
      >
        {creatingTable ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.createButtonText}>Create Table</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity 
        style={styles.cancelButton}
        onPress={() => setShowCreateTableModal(false)}
      >
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  </View>
</Modal>
```

### Verification Checklist
- [ ] Tables section visible in club detail
- [ ] Create Table button works
- [ ] Table stake can be entered
- [ ] Tables list refreshes after creation
- [ ] Can see active tables

---

# LANE 13: POLISH & ERROR HANDLING
## Priority: MEDIUM
## Time: 45 minutes

### Tasks

1. **Add Error Boundaries**
   - Create ErrorBoundary component
   - Wrap main app layout

2. **Add Loading States**
   - Ensure all screens have loading indicators
   - Add skeleton loaders where appropriate

3. **Add Empty States**
   - Consistent empty state designs
   - Actionable empty states ("Create your first...")

4. **Add Network Error Handling**
   - Offline detection
   - Retry functionality
   - User-friendly error messages

5. **Add Pull-to-Refresh**
   - All list screens should support pull-to-refresh
   - Consistent behavior across app

### Files to Create/Modify

**CREATE: `components/ErrorBoundary.tsx`**
```typescript
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Oops!</Text>
          <Text style={styles.message}>Something went wrong.</Text>
          <TouchableOpacity style={styles.button} onPress={this.handleReset}>
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  message: { fontSize: 16, color: '#666', marginTop: 8 },
  button: { backgroundColor: '#667eea', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, marginTop: 24 },
  buttonText: { color: 'white', fontWeight: '600' },
});
```

**CREATE: `components/EmptyState.tsx`**
```typescript
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  actionText?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, message, actionText, onAction }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={64} color="#D1D5DB" />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {actionText && onAction && (
        <TouchableOpacity style={styles.button} onPress={onAction}>
          <Text style={styles.buttonText}>{actionText}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', padding: 48 },
  title: { fontSize: 18, fontWeight: '600', color: '#374151', marginTop: 16 },
  message: { fontSize: 14, color: '#6B7280', marginTop: 8, textAlign: 'center' },
  button: { backgroundColor: '#667eea', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, marginTop: 24 },
  buttonText: { color: 'white', fontWeight: '600' },
});
```

**CREATE: `hooks/useNetworkStatus.ts`**
```typescript
import { useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';

export function useNetworkStatus() {
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected ?? true);
    });

    return () => unsubscribe();
  }, []);

  return isConnected;
}
```

### Verification Checklist
- [ ] ErrorBoundary wraps app
- [ ] All screens have loading states
- [ ] Empty states are consistent
- [ ] Network errors show friendly messages
- [ ] Pull-to-refresh works everywhere

---

# LANE 14: TESTING & BUG FIXES
## Priority: HIGH
## Time: 60 minutes

### Manual Testing Checklist

**Authentication**
- [ ] Register new user → gets 10,000 gold
- [ ] Login existing user → correct data loads
- [ ] Logout → returns to welcome screen
- [ ] Token refresh → doesn't logout unexpectedly

**Gold System**
- [ ] Shop shows gold packages
- [ ] Daily bonus can be claimed once
- [ ] Daily bonus shows "Already claimed" after
- [ ] Gold balance updates after actions

**Profile**
- [ ] Shows correct username
- [ ] Shows correct gold balance
- [ ] Shows correct stats (level, wins, losses)
- [ ] Pull-to-refresh updates data

**Play Tab**
- [ ] Quick Match opens stake modal
- [ ] Match history shows real matches
- [ ] Practice button shows coming soon
- [ ] Private Match button shows coming soon

**Matchmaking**
- [ ] Can join queue with stake
- [ ] Can cancel queue search
- [ ] Matched players go to match screen
- [ ] Insufficient gold shows error

**Gameplay**
- [ ] Ready screen shows both players
- [ ] Game starts when both ready
- [ ] Dice rolls work
- [ ] Moves execute correctly
- [ ] Turn switches after all moves
- [ ] Game completes and shows winner
- [ ] Gold transfers correctly

**Clubs**
- [ ] Can create club (costs 50K gold)
- [ ] Can search/discover clubs
- [ ] Can join public club
- [ ] Can leave club
- [ ] Can view members
- [ ] Club chat works
- [ ] Can create tables

**Leaderboard**
- [ ] Shows rankings
- [ ] Sort by wins works
- [ ] Sort by level works
- [ ] Sort by gold works
- [ ] Sort by win rate works
- [ ] User's rank shows

### Bug Fix Template

For each bug found, document:
1. Screen/Feature
2. Steps to reproduce
3. Expected behavior
4. Actual behavior
5. Fix applied

---

# LANE 15: FINAL INTEGRATION
## Priority: CRITICAL
## Time: 30 minutes

### Final Checks

1. **All API Endpoints Called**
   - Verify no dead API functions
   - Check all services/api/*.ts files are imported

2. **All Stores Used**
   - authStore - login/logout/user data
   - matchStore - match state
   - clubStore - clubs data

3. **WebSocket Connected**
   - Connects on login
   - Reconnects on disconnect
   - Match events work
   - Chat events work

4. **Navigation Complete**
   - All tabs accessible
   - All detail screens work
   - Back navigation works
   - Deep links work (match/:id, club/:id)

5. **Data Flow**
   - User data persists after restart
   - Gold updates reflect everywhere
   - Match results update stats

### Final Verification Script

```
Run through the complete user journey:

1. Fresh install → Welcome screen
2. Register → Home with 10K gold
3. Claim daily bonus → 10.5K gold
4. View profile → All stats correct
5. View shop → Packages visible
6. View leaderboard → Rankings show
7. Search clubs → Results appear
8. Create club → Costs 50K (need to add gold or reduce cost)
9. Join existing club → Get welcome chips
10. Send chat message → Appears
11. Create table → Shows in list
12. Leave club → Removed from members
13. Quick match → Queue or match
14. Play game → Full flow
15. Win/lose → Gold changes
16. View match history → Shows result
17. Logout → Back to welcome
18. Login → All data restored
```

---

# COMPLETION TRACKING

| Lane | Status | Completion |
|------|--------|------------|
| Lane 8 - Gold & Shop | ⬜ Not Started | 0% |
| Lane 9 - Profile | ⬜ Not Started | 0% |
| Lane 10 - Play Tab | ⬜ Not Started | 0% |
| Lane 11 - Club Chat | ⬜ Not Started | 0% |
| Lane 12 - Club Tables | ⬜ Not Started | 0% |
| Lane 13 - Polish | ⬜ Not Started | 0% |
| Lane 14 - Testing | ⬜ Not Started | 0% |
| Lane 15 - Final | ⬜ Not Started | 0% |

**Overall Progress: 52.6% → Target: 100%**

---

# PROMPTS FOR CLAUDE CODE

## Lane 8 Prompt
```
Implement the Gold & Shop system for the Backgammon Club MVP.

Project paths:
- Frontend: ~/PILOT1/backgammon-mobile

Tasks:
1. CREATE services/api/goldApi.ts with functions: getBalance, getPackages, getTransactions, claimDailyBonus, createPurchaseIntent, confirmPurchase
2. REWRITE app/(tabs)/shop.tsx to:
   - Import and use goldApi
   - Display gold packages from API
   - Add working "Claim Daily Bonus" button
   - Show current gold balance
   - Add pull-to-refresh

The backend endpoints already exist at /v1/gold/*. You just need to wire the frontend.

Verify by: Opening shop tab should show packages and daily bonus button should work.
```

## Lane 9 Prompt
```
Fix the Profile screen to show real user data.

Project path: ~/PILOT1/backgammon-mobile

Tasks:
1. UPDATE app/(tabs)/profile.tsx to:
   - Import authApi from services/api/authApi
   - Call authApi.getProfile() on mount with useEffect
   - Update authStore with the fetched user data
   - Add pull-to-refresh functionality
   - Show loading state while fetching
   - Display all user stats: gold, level, xp, wins, losses, total matches

2. UPDATE store/authStore.ts to ensure setUser function is exported

Verify by: Profile should show correct gold balance and stats, pull-down should refresh.
```

## Lane 10 Prompt
```
Complete the Play tab with match history and button functionality.

Project path: ~/PILOT1/backgammon-mobile

Tasks:
1. UPDATE app/(tabs)/index.tsx to:
   - Import matchApi from services/api/matchApi
   - Call matchApi.getHistory(5) on mount
   - Display recent matches with opponent name, result, gold change
   - Wire Practice button to show Alert "Coming Soon"
   - Wire Private Match button to show Alert "Coming Soon"
   - Add pull-to-refresh for match history

Verify by: Play tab should show real match history, buttons should show alerts.
```

## Lane 11 Prompt
```
Add club chat functionality to the club detail screen.

Project path: ~/PILOT1/backgammon-mobile

Tasks:
1. UPDATE app/club/[id].tsx to:
   - Import useClubSocket from hooks/useWebSocket
   - Import clubsApi for getChatHistory
   - Add chat message list UI
   - Add text input and send button
   - Fetch chat history on mount
   - Send messages via WebSocket
   - Display new messages in real-time

2. UPDATE services/api/clubsApi.ts to add getChatHistory if missing

Verify by: Can send and receive chat messages in a club.
```

## Lane 12 Prompt
```
Add club table creation and display.

Project path: ~/PILOT1/backgammon-mobile

Tasks:
1. UPDATE app/club/[id].tsx to:
   - Add tables section showing active tables
   - Add "Create Table" button
   - Add modal for entering stake amount
   - Call clubsApi.createTable() when creating
   - Refresh tables list after creation
   - Show join button on each table

Verify by: Can create a table with chip stake in a club.
```

## Lane 13 Prompt
```
Add error handling and polish to the app.

Project path: ~/PILOT1/backgammon-mobile

Tasks:
1. CREATE components/ErrorBoundary.tsx - catches React errors
2. CREATE components/EmptyState.tsx - reusable empty state component
3. CREATE hooks/useNetworkStatus.ts - detects offline status
4. UPDATE app/_layout.tsx to wrap with ErrorBoundary
5. Ensure all screens have loading states
6. Ensure all lists have pull-to-refresh

Verify by: App handles errors gracefully, shows loading states.
```

---

# SUCCESS CRITERIA

After all lanes complete:

✅ Shop displays gold packages and daily bonus works
✅ Profile shows real user data with refresh
✅ Play tab shows match history
✅ Practice/Private buttons show coming soon
✅ Club chat is fully functional
✅ Club tables can be created and viewed
✅ Error handling is in place
✅ All features tested and working
✅ No dead code/unwired features

**Target: 100% MVP Complete**
