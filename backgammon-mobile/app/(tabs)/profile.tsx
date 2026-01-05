import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';

export default function ProfileTab() {
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: () => logout(),
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.username?.charAt(0).toUpperCase() ?? '?'}
          </Text>
        </View>
        <Text style={styles.username}>{user?.username ?? 'Player'}</Text>
        <Text style={styles.email}>{user?.email ?? ''}</Text>
      </View>

      <View style={styles.statsCard}>
        <View style={styles.statRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{user?.gold_balance?.toLocaleString() ?? 0}</Text>
            <Text style={styles.statLabel}>Gold</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{user?.level ?? 1}</Text>
            <Text style={styles.statLabel}>Level</Text>
          </View>
        </View>
        <View style={styles.statRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{user?.wins ?? 0}</Text>
            <Text style={styles.statLabel}>Wins</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{user?.losses ?? 0}</Text>
            <Text style={styles.statLabel}>Losses</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{user?.total_matches ?? 0}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity 
        style={styles.logoutButton}
        onPress={handleLogout}
        activeOpacity={0.8}
      >
        <Ionicons name="log-out-outline" size={20} color="#DC2626" />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 16 },
  avatarContainer: { alignItems: 'center', marginVertical: 24 },
  avatar: { 
    width: 100, 
    height: 100, 
    borderRadius: 50, 
    backgroundColor: '#667eea', 
    justifyContent: 'center', 
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: { fontSize: 40, fontWeight: 'bold', color: 'white' },
  username: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  email: { fontSize: 14, color: '#666', marginTop: 4 },
  statsCard: { 
    backgroundColor: 'white', 
    borderRadius: 16, 
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  statRow: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 8 },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: 'bold', color: '#667eea' },
  statLabel: { fontSize: 12, color: '#666', marginTop: 4 },
  logoutButton: { 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginTop: 24,
    gap: 8,
  },
  logoutText: { color: '#DC2626', fontSize: 16, fontWeight: '600' },
});
