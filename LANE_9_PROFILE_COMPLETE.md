# 👤 LANE 9: PROFILE & USER DATA - COMPLETE
## Fix Profile Screen to Show Real Data
## Copy-Paste Ready Code

---

## OVERVIEW

**Problem:**
- Profile shows stale data (0 gold, "Player" name)
- `authApi.getProfile()` exists but is never called
- No way to refresh user data
- WebSocket gold updates may not reflect in store

**Solution:**
- Call getProfile() on mount
- Add pull-to-refresh
- Display all user statistics
- Update store with fresh data

**Time:** 30 minutes

**Prerequisites:**
- Lane 8 complete
- Backend running on port 8000

---

## PHASE 1: Update Profile Screen

### Step 1.1: Replace profile.tsx

Replace the entire contents of `app/(tabs)/profile.tsx`:

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
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { authApi } from '../../services/api/authApi';

export default function ProfileTab() {
  const router = useRouter();
  const { user, setUser, logout } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // ==================== FETCH PROFILE ====================
  const fetchProfile = useCallback(async () => {
    try {
      const { data } = await authApi.getProfile();
      if (data.success && data.user) {
        setUser(data.user);
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      // Don't show error alert on initial load if we have cached data
      if (!user) {
        Alert.alert('Error', 'Failed to load profile data');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [setUser, user]);

  useEffect(() => {
    fetchProfile();
  }, []);

  // ==================== HANDLERS ====================
  const handleRefresh = () => {
    setRefreshing(true);
    fetchProfile();
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              router.replace('/(auth)/welcome');
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Error', 'Failed to logout. Please try again.');
            }
          },
        },
      ]
    );
  };

  const getWinRate = (): number => {
    if (!user || user.total_matches === 0) return 0;
    return Math.round((user.wins / user.total_matches) * 100);
  };

  const getXpProgress = (): number => {
    if (!user) return 0;
    const xpForNextLevel = user.level * 1000; // Example: 1000 XP per level
    return (user.xp % 1000) / 10; // Returns percentage
  };

  // ==================== RENDER ====================
  if (loading && !user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor="#667eea"
        />
      }
    >
      {/* ==================== HEADER / AVATAR ==================== */}
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.avatarContainer}>
          {user?.avatar_url ? (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.username?.charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.username?.charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.username}>{user?.username || 'Unknown'}</Text>
        <Text style={styles.email}>{user?.email || ''}</Text>

        {/* Level Badge */}
        <View style={styles.levelBadge}>
          <Ionicons name="star" size={14} color="#F59E0B" />
          <Text style={styles.levelText}>Level {user?.level || 1}</Text>
        </View>

        {/* XP Progress Bar */}
        <View style={styles.xpContainer}>
          <View style={styles.xpBar}>
            <View style={[styles.xpProgress, { width: `${getXpProgress()}%` }]} />
          </View>
          <Text style={styles.xpText}>{user?.xp || 0} XP</Text>
        </View>
      </LinearGradient>

      {/* ==================== GOLD CARD ==================== */}
      <View style={styles.goldCard}>
        <View style={styles.goldIconContainer}>
          <Text style={styles.goldIcon}>🪙</Text>
        </View>
        <View style={styles.goldInfo}>
          <Text style={styles.goldLabel}>Gold Balance</Text>
          <Text style={styles.goldValue}>
            {(user?.gold_balance || 0).toLocaleString()}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.shopButton}
          onPress={() => router.push('/(tabs)/shop')}
        >
          <Ionicons name="cart" size={18} color="#667eea" />
          <Text style={styles.shopButtonText}>Shop</Text>
        </TouchableOpacity>
      </View>

      {/* ==================== GAME STATISTICS ==================== */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Game Statistics</Text>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Ionicons name="game-controller" size={24} color="#667eea" />
            <Text style={styles.statValue}>{user?.total_matches || 0}</Text>
            <Text style={styles.statLabel}>Total Matches</Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="trophy" size={24} color="#10B981" />
            <Text style={[styles.statValue, { color: '#10B981' }]}>
              {user?.wins || 0}
            </Text>
            <Text style={styles.statLabel}>Wins</Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="close-circle" size={24} color="#EF4444" />
            <Text style={[styles.statValue, { color: '#EF4444' }]}>
              {user?.losses || 0}
            </Text>
            <Text style={styles.statLabel}>Losses</Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="analytics" size={24} color="#F59E0B" />
            <Text style={[styles.statValue, { color: '#F59E0B' }]}>
              {getWinRate()}%
            </Text>
            <Text style={styles.statLabel}>Win Rate</Text>
          </View>
        </View>
      </View>

      {/* ==================== GOLD STATISTICS ==================== */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Gold Statistics</Text>

        <View style={styles.goldStatsCard}>
          <View style={styles.goldStatRow}>
            <View style={styles.goldStatLeft}>
              <Ionicons name="trending-up" size={20} color="#10B981" />
              <Text style={styles.goldStatLabel}>Total Earned</Text>
            </View>
            <Text style={[styles.goldStatValue, { color: '#10B981' }]}>
              +{(user?.total_gold_earned || 0).toLocaleString()}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.goldStatRow}>
            <View style={styles.goldStatLeft}>
              <Ionicons name="trending-down" size={20} color="#EF4444" />
              <Text style={styles.goldStatLabel}>Total Spent</Text>
            </View>
            <Text style={[styles.goldStatValue, { color: '#EF4444' }]}>
              -{(user?.total_gold_spent || 0).toLocaleString()}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.goldStatRow}>
            <View style={styles.goldStatLeft}>
              <Ionicons name="wallet" size={20} color="#667eea" />
              <Text style={styles.goldStatLabel}>Net Balance</Text>
            </View>
            <Text style={[styles.goldStatValue, { color: '#667eea' }]}>
              {(
                (user?.total_gold_earned || 0) - (user?.total_gold_spent || 0)
              ).toLocaleString()}
            </Text>
          </View>
        </View>
      </View>

      {/* ==================== ACCOUNT INFO ==================== */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={styles.infoLeft}>
              <Ionicons name="flag" size={20} color="#9CA3AF" />
              <Text style={styles.infoLabel}>Country</Text>
            </View>
            <Text style={styles.infoValue}>{user?.country || 'Not set'}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <View style={styles.infoLeft}>
              <Ionicons name="calendar" size={20} color="#9CA3AF" />
              <Text style={styles.infoLabel}>Member Since</Text>
            </View>
            <Text style={styles.infoValue}>
              {user?.created_at
                ? new Date(user.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })
                : 'Unknown'}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <View style={styles.infoLeft}>
              <Ionicons
                name={user?.email_verified ? 'checkmark-circle' : 'alert-circle'}
                size={20}
                color={user?.email_verified ? '#10B981' : '#F59E0B'}
              />
              <Text style={styles.infoLabel}>Email Status</Text>
            </View>
            <Text
              style={[
                styles.infoValue,
                { color: user?.email_verified ? '#10B981' : '#F59E0B' },
              ]}
            >
              {user?.email_verified ? 'Verified' : 'Not Verified'}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <View style={styles.infoLeft}>
              <Ionicons name="gift" size={20} color="#9CA3AF" />
              <Text style={styles.infoLabel}>Last Daily Bonus</Text>
            </View>
            <Text style={styles.infoValue}>
              {user?.last_daily_bonus_claim
                ? new Date(user.last_daily_bonus_claim).toLocaleDateString()
                : 'Never'}
            </Text>
          </View>
        </View>
      </View>

      {/* ==================== LOGOUT BUTTON ==================== */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={22} color="#EF4444" />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      {/* ==================== VERSION INFO ==================== */}
      <Text style={styles.versionText}>Backgammon Club v1.0.0</Text>

      <View style={{ height: 40 }} />
    </ScrollView>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },

  // Header
  header: {
    paddingTop: 20,
    paddingBottom: 30,
    alignItems: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  avatarContainer: {
    marginBottom: 12,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  avatarText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: 'white',
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 4,
  },
  email: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 12,
    gap: 4,
  },
  levelText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 13,
  },
  xpContainer: {
    width: '80%',
    marginTop: 12,
    alignItems: 'center',
  },
  xpBar: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  xpProgress: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: 3,
  },
  xpText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 11,
    marginTop: 4,
  },

  // Gold Card
  goldCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: -20,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  goldIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  goldIcon: {
    fontSize: 28,
  },
  goldInfo: {
    flex: 1,
    marginLeft: 12,
  },
  goldLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  goldValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F59E0B',
  },
  shopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  shopButtonText: {
    color: '#667eea',
    fontWeight: '600',
  },

  // Section
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: '47%',
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
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },

  // Gold Stats Card
  goldStatsCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  goldStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  goldStatLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  goldStatLabel: {
    fontSize: 14,
    color: '#4B5563',
  },
  goldStatValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
  },

  // Info Card
  infoCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  infoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoLabel: {
    fontSize: 14,
    color: '#4B5563',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },

  // Logout Button
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: 24,
    padding: 16,
    borderRadius: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },

  // Version
  versionText: {
    textAlign: 'center',
    marginTop: 24,
    fontSize: 12,
    color: '#9CA3AF',
  },
});
```

---

## PHASE 2: Ensure authApi has getProfile

### Step 2.1: Verify authApi.ts

Check that `services/api/authApi.ts` has the `getProfile` function. If not, add it:

```typescript
// In services/api/authApi.ts, ensure this exists:

getProfile: () =>
  apiClient.get<{ success: boolean; user: User }>('/auth/profile'),
```

**Complete authApi.ts reference** (verify yours matches):

```typescript
import apiClient from './axiosInstance';
import { User } from '../../store/authStore';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
  country: string;
  age_confirmed: boolean;
}

export interface AuthResponse {
  success: boolean;
  user: User;
  tokens: {
    access_token: string;
    refresh_token: string;
  };
}

export const authApi = {
  register: (data: RegisterRequest) =>
    apiClient.post<AuthResponse>('/auth/register', data),

  login: (data: LoginRequest) =>
    apiClient.post<AuthResponse>('/auth/login', data),

  logout: () =>
    apiClient.post<{ success: boolean }>('/auth/logout'),

  refreshToken: (refreshToken: string) =>
    apiClient.post<{
      success: boolean;
      tokens: { access_token: string; refresh_token: string };
    }>('/auth/refresh', { refresh_token: refreshToken }),

  getProfile: () =>
    apiClient.get<{ success: boolean; user: User }>('/auth/profile'),
};

export default authApi;
```

---

## PHASE 3: Add setUser to Auth Store (if missing)

### Step 3.1: Verify authStore has setUser

The profile screen calls `setUser(data.user)`. Make sure your authStore exports this function.

Check `store/authStore.ts` has:

```typescript
// In the interface:
setUser: (user: User) => void;

// In the implementation:
setUser: (user) => set({ user }),
```

See Lane 8 for complete authStore.ts reference.

---

## ✅ LANE 9 VERIFICATION CHECKLIST

After implementing, verify:

- [ ] Profile screen loads without errors
- [ ] Username displays correctly (not "Player")
- [ ] Gold balance shows correct amount (not 0)
- [ ] Level and XP display correctly
- [ ] Game stats (matches, wins, losses) show real data
- [ ] Gold stats (earned, spent) show real data
- [ ] Account info (country, member since) displays
- [ ] Pull-to-refresh updates all data
- [ ] Logout button works

---

## 📁 FILES CREATED/MODIFIED

| File | Action |
|------|--------|
| `app/(tabs)/profile.tsx` | REPLACE |
| `services/api/authApi.ts` | VERIFY (add getProfile if missing) |
| `store/authStore.ts` | VERIFY (add setUser if missing) |

---

## 🚀 READY FOR LANE 10

After Lane 9 is complete:
- Profile shows real user data
- All statistics display correctly
- Pull-to-refresh works
- Gold balance is accurate

Proceed to **Lane 10: Play Tab Completion**
