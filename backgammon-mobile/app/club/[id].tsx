import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useClubStore } from '../../store/clubStore';
import { useAuthStore } from '../../store/authStore';

type LobbyTab = 'tables' | 'members' | 'chat';

export default function ClubDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [activeTab, setActiveTab] = useState<LobbyTab>('tables');
  const [joining, setJoining] = useState(false);

  const {
    currentClub,
    currentMembership,
    currentMembers,
    currentTables,
    currentClubLoading,
    fetchClubDetails,
    fetchMembers,
    fetchTables,
    joinClub,
    leaveClub,
    clearCurrentClub,
  } = useClubStore();

  useEffect(() => {
    if (id) {
      fetchClubDetails(id);
      fetchMembers(id);
      fetchTables(id);
    }
    return () => clearCurrentClub();
  }, [id]);

  const handleJoin = async () => {
    if (!id) return;
    setJoining(true);
    try {
      await joinClub(id);
      Alert.alert('Success', 'You joined the club!');
    } catch (error: any) {
      if (error.response?.data?.details?.request_sent) {
        Alert.alert('Request Sent', 'Your join request has been sent to the club admins.');
      } else {
        Alert.alert('Error', error.response?.data?.error || 'Failed to join club');
      }
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = () => {
    Alert.alert(
      'Leave Club',
      'Are you sure you want to leave this club?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await leaveClub(id!);
              router.back();
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.error || 'Failed to leave club');
            }
          },
        },
      ]
    );
  };

  if (currentClubLoading || !currentClub) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

  const isMember = !!currentMembership;
  const isOwner = currentMembership?.role === 'owner';
  const isAdmin = currentMembership?.role === 'admin' || isOwner;

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: currentClub.name,
          headerRight: () => isMember && !isOwner ? (
            <TouchableOpacity onPress={handleLeave}>
              <Text style={styles.leaveButton}>Leave</Text>
            </TouchableOpacity>
          ) : null,
        }}
      />
      <View style={styles.container}>
        {/* Club Header */}
        <View style={styles.header}>
          <View style={styles.clubIcon}>
            <Text style={styles.clubIconText}>
              {currentClub.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.clubName}>{currentClub.name}</Text>
            <Text style={styles.clubStats}>
              {currentClub.member_count} members • {currentClub.privacy === 'private' ? '🔒 Private' : 'Public'}
            </Text>
            {currentClub.description && (
              <Text style={styles.description} numberOfLines={2}>
                {currentClub.description}
              </Text>
            )}
          </View>
        </View>

        {/* Member Chip Balance or Join Button */}
        {isMember ? (
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Your Chips</Text>
            <Text style={styles.balanceAmount}>
              🎰 {currentMembership.chip_balance.toLocaleString()}
            </Text>
            <Text style={styles.roleLabel}>{currentMembership.role.toUpperCase()}</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.joinButton, joining && styles.joinButtonDisabled]}
            onPress={handleJoin}
            disabled={joining}
          >
            {joining ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Ionicons name="enter-outline" size={20} color="white" />
                <Text style={styles.joinButtonText}>Join Club</Text>
                {currentClub.welcome_bonus > 0 && (
                  <Text style={styles.welcomeBonusText}>
                    +{currentClub.welcome_bonus.toLocaleString()} chips!
                  </Text>
                )}
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Lobby Tabs (only for members) */}
        {isMember && (
          <>
            <View style={styles.tabBar}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'tables' && styles.tabActive]}
                onPress={() => setActiveTab('tables')}
              >
                <Ionicons
                  name="game-controller-outline"
                  size={20}
                  color={activeTab === 'tables' ? '#667eea' : '#666'}
                />
                <Text style={[styles.tabText, activeTab === 'tables' && styles.tabTextActive]}>
                  Tables
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'members' && styles.tabActive]}
                onPress={() => setActiveTab('members')}
              >
                <Ionicons
                  name="people-outline"
                  size={20}
                  color={activeTab === 'members' ? '#667eea' : '#666'}
                />
                <Text style={[styles.tabText, activeTab === 'members' && styles.tabTextActive]}>
                  Members
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'chat' && styles.tabActive]}
                onPress={() => setActiveTab('chat')}
              >
                <Ionicons
                  name="chatbubbles-outline"
                  size={20}
                  color={activeTab === 'chat' ? '#667eea' : '#666'}
                />
                <Text style={[styles.tabText, activeTab === 'chat' && styles.tabTextActive]}>
                  Chat
                </Text>
              </TouchableOpacity>
            </View>

            {/* Tab Content */}
            <View style={styles.tabContent}>
              {activeTab === 'tables' && (
                currentTables.length === 0 ? (
                  <View style={styles.emptyTab}>
                    <Ionicons name="game-controller-outline" size={48} color="#ccc" />
                    <Text style={styles.emptyTabText}>No active tables</Text>
                    <Text style={styles.emptyTabSubtext}>Create a table to start playing!</Text>
                  </View>
                ) : (
                  <FlatList
                    data={currentTables}
                    keyExtractor={(item) => item.table_id}
                    renderItem={({ item }) => (
                      <View style={styles.tableCard}>
                        <View>
                          <Text style={styles.tableName}>Table by {item.creator_username}</Text>
                          <Text style={styles.tableStake}>🎰 {item.stake_amount} chips</Text>
                        </View>
                        <TouchableOpacity style={styles.joinTableButton}>
                          <Text style={styles.joinTableText}>Join</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  />
                )
              )}

              {activeTab === 'members' && (
                <FlatList
                  data={currentMembers}
                  keyExtractor={(item) => item.membership_id}
                  renderItem={({ item }) => (
                    <View style={styles.memberCard}>
                      <View style={styles.memberAvatar}>
                        <Text style={styles.memberAvatarText}>
                          {item.username?.charAt(0).toUpperCase() ?? '?'}
                        </Text>
                      </View>
                      <View style={styles.memberInfo}>
                        <Text style={styles.memberName}>{item.username}</Text>
                        <Text style={styles.memberRole}>{item.role}</Text>
                      </View>
                      <Text style={styles.memberChips}>
                        🎰 {item.chip_balance.toLocaleString()}
                      </Text>
                    </View>
                  )}
                />
              )}

              {activeTab === 'chat' && (
                <View style={styles.emptyTab}>
                  <Ionicons name="chatbubbles-outline" size={48} color="#ccc" />
                  <Text style={styles.emptyTabText}>Chat coming soon!</Text>
                  <Text style={styles.emptyTabSubtext}>Requires Lane 4 (WebSocket)</Text>
                </View>
              )}
            </View>
          </>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  leaveButton: { color: '#DC2626', fontSize: 16, marginRight: 16 },
  header: { flexDirection: 'row', padding: 16, backgroundColor: 'white' },
  clubIcon: { width: 70, height: 70, borderRadius: 16, backgroundColor: '#667eea', justifyContent: 'center', alignItems: 'center' },
  clubIconText: { fontSize: 28, fontWeight: 'bold', color: 'white' },
  headerInfo: { flex: 1, marginLeft: 16, justifyContent: 'center' },
  clubName: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  clubStats: { fontSize: 14, color: '#666', marginTop: 4 },
  description: { fontSize: 12, color: '#999', marginTop: 4 },
  balanceCard: {
    backgroundColor: '#667eea',
    margin: 16,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center'
  },
  balanceLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  balanceAmount: { color: 'white', fontSize: 32, fontWeight: 'bold', marginTop: 4 },
  roleLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 12, marginTop: 8, fontWeight: '600' },
  joinButton: {
    backgroundColor: '#10B981',
    margin: 16,
    padding: 18,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  joinButtonDisabled: { opacity: 0.7 },
  joinButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  welcomeBonusText: { color: 'rgba(255,255,255,0.9)', fontSize: 12 },
  tabBar: { flexDirection: 'row', backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#eee' },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 6 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#667eea' },
  tabText: { fontSize: 14, color: '#666' },
  tabTextActive: { color: '#667eea', fontWeight: '600' },
  tabContent: { flex: 1 },
  emptyTab: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyTabText: { fontSize: 16, color: '#666', marginTop: 12 },
  emptyTabSubtext: { fontSize: 12, color: '#999', marginTop: 4 },
  tableCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'white', padding: 16, marginHorizontal: 16, marginTop: 12, borderRadius: 12 },
  tableName: { fontSize: 14, fontWeight: '600', color: '#333' },
  tableStake: { fontSize: 12, color: '#666', marginTop: 4 },
  joinTableButton: { backgroundColor: '#667eea', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  joinTableText: { color: 'white', fontWeight: '600' },
  memberCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', padding: 12, marginHorizontal: 16, marginTop: 8, borderRadius: 8 },
  memberAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#667eea', justifyContent: 'center', alignItems: 'center' },
  memberAvatarText: { color: 'white', fontWeight: 'bold' },
  memberInfo: { flex: 1, marginLeft: 12 },
  memberName: { fontSize: 14, fontWeight: '600', color: '#333' },
  memberRole: { fontSize: 11, color: '#666', marginTop: 2 },
  memberChips: { fontSize: 14, fontWeight: '600', color: '#667eea' },
});
