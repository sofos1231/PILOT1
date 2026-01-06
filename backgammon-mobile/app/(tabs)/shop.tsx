import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { goldApi, GoldPackage, GoldTransaction } from '../../services/api/goldApi';
import { useAuthStore } from '../../store/authStore';

export default function ShopTab() {
  // ==================== STATE ====================
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const [packages, setPackages] = useState<GoldPackage[]>([]);
  const [transactions, setTransactions] = useState<GoldTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [claimingBonus, setClaimingBonus] = useState(false);
  const [canClaimBonus, setCanClaimBonus] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // ==================== DATA FETCHING ====================
  const fetchData = useCallback(async () => {
    try {
      const [packagesRes, balanceRes] = await Promise.all([
        goldApi.getPackages(),
        goldApi.getBalance(),
      ]);

      if (packagesRes.data.success) {
        setPackages(packagesRes.data.packages);
      }

      if (balanceRes.data.success) {
        setCanClaimBonus(balanceRes.data.can_claim_daily_bonus);
        // Update user balance in store
        if (user && balanceRes.data.balance !== user.gold_balance) {
          setUser({ ...user, gold_balance: balanceRes.data.balance });
        }
      }
    } catch (error) {
      console.error('Failed to fetch shop data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, setUser]);

  const fetchTransactions = async () => {
    setLoadingHistory(true);
    try {
      const { data } = await goldApi.getTransactions(20);
      if (data.success) {
        setTransactions(data.transactions);
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ==================== HANDLERS ====================
  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleClaimDailyBonus = async () => {
    if (!canClaimBonus || claimingBonus) return;

    setClaimingBonus(true);
    try {
      const { data } = await goldApi.claimDailyBonus();

      if (data.success) {
        // Update user balance in store
        if (user) {
          setUser({ ...user, gold_balance: data.new_balance });
        }
        setCanClaimBonus(false);

        Alert.alert(
          'Daily Bonus Claimed!',
          `You received ${data.amount.toLocaleString()} gold!\n\nNew balance: ${data.new_balance.toLocaleString()} gold`,
          [{ text: 'Awesome!' }]
        );
      }
    } catch (error: any) {
      const message = error.response?.data?.error || 'Failed to claim bonus';

      if (message.toLowerCase().includes('already claimed')) {
        setCanClaimBonus(false);
        Alert.alert('Already Claimed', 'You have already claimed your daily bonus today. Come back tomorrow!');
      } else {
        Alert.alert('Error', message);
      }
    } finally {
      setClaimingBonus(false);
    }
  };

  const handlePurchase = async (pkg: GoldPackage) => {
    const bonusAmount = Math.floor(pkg.gold_amount * pkg.bonus_percent / 100);
    const totalGold = pkg.gold_amount + bonusAmount;

    Alert.alert(
      'Confirm Purchase',
      `Buy ${pkg.gold_amount.toLocaleString()} gold${bonusAmount > 0 ? ` (+${bonusAmount.toLocaleString()} bonus)` : ''} for $${pkg.price_usd.toFixed(2)}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Buy Now',
          onPress: async () => {
            try {
              setLoading(true);

              const { data: result } = await goldApi.demoPurchase(pkg.id);

              // Update local balance
              if (result.new_balance !== undefined && user) {
                setUser({ ...user, gold_balance: result.new_balance });
              } else {
                // Refresh balance from server
                await fetchData();
              }

              // Show success message
              Alert.alert(
                'Purchase Successful!',
                `You received ${totalGold.toLocaleString()} gold!`,
                [{ text: 'OK' }]
              );

            } catch (error: any) {
              console.error('Purchase error:', error);
              Alert.alert(
                'Purchase Failed',
                error.response?.data?.message || error.response?.data?.error || error.message || 'Please try again',
                [{ text: 'OK' }]
              );
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleShowHistory = async () => {
    setShowHistory(true);
    fetchTransactions();
  };

  const getTransactionIcon = (type: string): string => {
    switch (type) {
      case 'purchase':
        return 'card';
      case 'match_win':
        return 'trophy';
      case 'match_loss':
        return 'game-controller';
      case 'daily_bonus':
        return 'gift';
      case 'club_creation':
        return 'people';
      case 'refund':
        return 'refresh';
      case 'admin_grant':
        return 'shield';
      default:
        return 'cash';
    }
  };

  const getTransactionColor = (amount: number): string => {
    return amount >= 0 ? '#10B981' : '#EF4444';
  };

  // ==================== RENDER ====================
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>Loading shop...</Text>
      </View>
    );
  }

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
        {/* ==================== BALANCE CARD ==================== */}
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.balanceCard}
        >
          <Text style={styles.balanceLabel}>Your Gold Balance</Text>
          <Text style={styles.balanceValue}>
            {(user?.gold_balance || 0).toLocaleString()} Gold
          </Text>
          <TouchableOpacity
            style={styles.historyButton}
            onPress={handleShowHistory}
          >
            <Ionicons name="time-outline" size={16} color="rgba(255,255,255,0.9)" />
            <Text style={styles.historyButtonText}>Transaction History</Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* ==================== DAILY BONUS ==================== */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="gift" size={24} color="#F59E0B" />
            <Text style={styles.sectionTitle}>Daily Bonus</Text>
          </View>

          <TouchableOpacity
            style={[
              styles.bonusCard,
              !canClaimBonus && styles.bonusCardDisabled,
            ]}
            onPress={handleClaimDailyBonus}
            disabled={!canClaimBonus || claimingBonus}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={canClaimBonus ? ['#10B981', '#059669'] : ['#9CA3AF', '#6B7280']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.bonusGradient}
            >
              {claimingBonus ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <>
                  <View style={styles.bonusLeft}>
                    <Text style={styles.bonusEmoji}>*</Text>
                    <View>
                      <Text style={styles.bonusTitle}>
                        {canClaimBonus ? 'Claim Your Bonus!' : 'Already Claimed'}
                      </Text>
                      <Text style={styles.bonusSubtitle}>
                        {canClaimBonus
                          ? 'Free 500 gold every day'
                          : 'Come back tomorrow'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.bonusRight}>
                    <Text style={styles.bonusAmount}>+500</Text>
                    <Ionicons name="diamond" size={20} color="white" />
                  </View>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* ==================== GOLD PACKAGES ==================== */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="diamond" size={24} color="#667eea" />
            <Text style={styles.sectionTitle}>Gold Packages</Text>
          </View>

          {packages.length === 0 ? (
            <View style={styles.emptyPackages}>
              <Text style={styles.emptyText}>No packages available</Text>
            </View>
          ) : (
            packages.map((pkg, index) => (
              <TouchableOpacity
                key={pkg.id || index}
                style={[styles.packageCard, pkg.popular && styles.packageCardPopular]}
                onPress={() => handlePurchase(pkg)}
                activeOpacity={0.8}
              >
                {pkg.popular && (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularBadgeText}>BEST VALUE</Text>
                  </View>
                )}

                <View style={styles.packageLeft}>
                  <Text style={styles.packageName}>{pkg.name}</Text>
                  <View style={styles.packageGoldRow}>
                    <Text style={styles.packageGold}>
                      {pkg.gold_amount.toLocaleString()} Gold
                    </Text>
                    {pkg.bonus_percent > 0 && (
                      <View style={styles.bonusBadge}>
                        <Text style={styles.bonusBadgeText}>
                          +{pkg.bonus_percent}%
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.packageRight}>
                  <Text style={styles.packagePrice}>
                    ${pkg.price_usd.toFixed(2)}
                  </Text>
                  <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* ==================== INFO SECTION ==================== */}
        <View style={styles.infoSection}>
          <Ionicons name="information-circle-outline" size={20} color="#9CA3AF" />
          <Text style={styles.infoText}>
            Gold is used for Quick Matches, creating clubs, and more. Win matches to earn gold!
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ==================== TRANSACTION HISTORY MODAL ==================== */}
      <Modal
        visible={showHistory}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowHistory(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Transaction History</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowHistory(false)}
            >
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          {loadingHistory ? (
            <View style={styles.modalLoading}>
              <ActivityIndicator size="large" color="#667eea" />
            </View>
          ) : transactions.length === 0 ? (
            <View style={styles.modalEmpty}>
              <Ionicons name="receipt-outline" size={64} color="#D1D5DB" />
              <Text style={styles.modalEmptyText}>No transactions yet</Text>
            </View>
          ) : (
            <ScrollView style={styles.transactionList}>
              {transactions.map((tx, index) => (
                <View key={tx.transaction_id || index} style={styles.transactionItem}>
                  <View style={styles.transactionIcon}>
                    <Ionicons
                      name={getTransactionIcon(tx.type) as any}
                      size={20}
                      color="#667eea"
                    />
                  </View>
                  <View style={styles.transactionInfo}>
                    <Text style={styles.transactionDesc}>
                      {tx.description || tx.type.replace('_', ' ')}
                    </Text>
                    <Text style={styles.transactionDate}>
                      {new Date(tx.created_at).toLocaleDateString()} at{' '}
                      {new Date(tx.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.transactionAmount,
                      { color: getTransactionColor(tx.amount) },
                    ]}
                  >
                    {tx.amount >= 0 ? '+' : ''}
                    {tx.amount.toLocaleString()}
                  </Text>
                </View>
              ))}
            </ScrollView>
          )}
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

  // Balance Card
  balanceCard: {
    margin: 16,
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  balanceLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  balanceValue: {
    fontSize: 42,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 8,
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    gap: 6,
  },
  historyButtonText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 13,
    fontWeight: '500',
  },

  // Section
  section: {
    paddingHorizontal: 16,
    marginTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },

  // Daily Bonus
  bonusCard: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  bonusCardDisabled: {
    opacity: 0.8,
  },
  bonusGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  bonusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bonusEmoji: {
    fontSize: 32,
  },
  bonusTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
  },
  bonusSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  bonusRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bonusAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },

  // Packages
  emptyPackages: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  packageCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  packageCardPopular: {
    borderColor: '#667eea',
    backgroundColor: '#F5F3FF',
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    right: 16,
    backgroundColor: '#667eea',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  popularBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '700',
  },
  packageLeft: {
    flex: 1,
  },
  packageName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  packageGoldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  packageGold: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F59E0B',
  },
  bonusBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  bonusBadgeText: {
    color: '#059669',
    fontSize: 11,
    fontWeight: '600',
  },
  packageRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  packagePrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#667eea',
  },

  // Info Section
  infoSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    margin: 16,
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  closeButton: {
    padding: 4,
  },
  modalLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalEmptyText: {
    fontSize: 16,
    color: '#9CA3AF',
    marginTop: 16,
  },
  transactionList: {
    flex: 1,
    padding: 16,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  transactionInfo: {
    flex: 1,
    marginLeft: 12,
  },
  transactionDesc: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    textTransform: 'capitalize',
  },
  transactionDate: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
});
