import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Modal, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { matchmakingApi } from '../../services/api/matchmakingApi';
import { Ionicons } from '@expo/vector-icons';

export default function PlayTab() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [showStakeModal, setShowStakeModal] = useState(false);
  const [stake, setStake] = useState('100');
  const [searching, setSearching] = useState(false);

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

      if (data.matched) {
        // Match found immediately!
        router.push(`/match/${data.match_id}`);
      } else {
        // In queue, wait for match
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

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.welcomeCard}>
        <Text style={styles.welcomeText}>Welcome back,</Text>
        <Text style={styles.username}>{user?.username ?? 'Player'}!</Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{user?.level ?? 1}</Text>
            <Text style={styles.statLabel}>Level</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{user?.wins ?? 0}</Text>
            <Text style={styles.statLabel}>Wins</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{user?.total_matches ?? 0}</Text>
            <Text style={styles.statLabel}>Matches</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={styles.quickMatchButton}
        activeOpacity={0.9}
        onPress={() => setShowStakeModal(true)}
      >
        <Ionicons name="flash" size={28} color="white" />
        <Text style={styles.quickMatchText}>Quick Match</Text>
        <Text style={styles.quickMatchSubtext}>Find an opponent now</Text>
      </TouchableOpacity>

      <View style={styles.optionsGrid}>
        <TouchableOpacity style={styles.optionCard} activeOpacity={0.8}>
          <Ionicons name="game-controller-outline" size={32} color="#667eea" />
          <Text style={styles.optionTitle}>Practice</Text>
          <Text style={styles.optionSubtext}>Play vs AI</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.optionCard} activeOpacity={0.8}>
          <Ionicons name="people-outline" size={32} color="#667eea" />
          <Text style={styles.optionTitle}>Private Match</Text>
          <Text style={styles.optionSubtext}>Invite a friend</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Matches</Text>
        <View style={styles.emptyState}>
          <Ionicons name="dice-outline" size={48} color="#ccc" />
          <Text style={styles.emptyStateText}>No matches yet</Text>
          <Text style={styles.emptyStateSubtext}>Play your first game!</Text>
        </View>
      </View>

      {/* Matchmaking Modal */}
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
                  style={[styles.stakeOption, stake === String(amount) && styles.stakeOptionSelected]}
                  onPress={() => setStake(String(amount))}
                >
                  <Text style={[styles.stakeOptionText, stake === String(amount) && styles.stakeOptionTextSelected]}>
                    {amount}
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

            <TouchableOpacity style={styles.findMatchButton} onPress={handleQuickMatch}>
              <Text style={styles.findMatchButtonText}>Find Match</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelButton} onPress={() => setShowStakeModal(false)}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 8, 
    elevation: 3 
  },
  welcomeText: { fontSize: 14, color: '#666' },
  username: { fontSize: 24, fontWeight: 'bold', color: '#333', marginBottom: 16 },
  statsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  statItem: { alignItems: 'center', flex: 1 },
  statDivider: { width: 1, height: 40, backgroundColor: '#eee' },
  statValue: { fontSize: 24, fontWeight: 'bold', color: '#667eea' },
  statLabel: { fontSize: 12, color: '#666', marginTop: 4 },
  quickMatchButton: { 
    backgroundColor: '#667eea', 
    marginHorizontal: 16, 
    padding: 24, 
    borderRadius: 16, 
    alignItems: 'center', 
    shadowColor: '#667eea', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.3, 
    shadowRadius: 8, 
    elevation: 5 
  },
  quickMatchText: { color: 'white', fontSize: 22, fontWeight: 'bold', marginTop: 8 },
  quickMatchSubtext: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 4 },
  optionsGrid: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  optionCard: { 
    flex: 1, 
    backgroundColor: 'white', 
    padding: 20, 
    borderRadius: 16, 
    alignItems: 'center', 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 8, 
    elevation: 3 
  },
  optionTitle: { fontSize: 14, fontWeight: '600', color: '#333', marginTop: 12 },
  optionSubtext: { fontSize: 11, color: '#666', marginTop: 4 },
  section: { padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  emptyState: { backgroundColor: 'white', padding: 32, borderRadius: 16, alignItems: 'center' },
  emptyStateText: { fontSize: 16, color: '#666', marginTop: 12 },
  emptyStateSubtext: { fontSize: 14, color: '#999', marginTop: 4 },
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
  findMatchButton: { backgroundColor: '#667eea', padding: 18, borderRadius: 12, marginTop: 24 },
  findMatchButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
  cancelButton: { marginTop: 12, padding: 12 },
  cancelButtonText: { color: '#666', fontSize: 16, textAlign: 'center' },
});
