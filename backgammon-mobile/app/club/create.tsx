import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useClubStore } from '../../store/clubStore';
import { useAuthStore } from '../../store/authStore';

const CLUB_CREATION_COST = 50000;

export default function CreateClubScreen() {
  const router = useRouter();
  const { createClub } = useClubStore();
  const user = useAuthStore((state) => state.user);
  const updateGoldBalance = useAuthStore((state) => state.updateGoldBalance);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [welcomeBonus, setWelcomeBonus] = useState('1000');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const canAfford = (user?.gold_balance || 0) >= CLUB_CREATION_COST;

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Club name is required';
    } else if (name.trim().length < 3) {
      newErrors.name = 'Name must be at least 3 characters';
    } else if (name.trim().length > 50) {
      newErrors.name = 'Name must be at most 50 characters';
    }

    const bonus = parseInt(welcomeBonus) || 0;
    if (bonus < 0 || bonus > 100000) {
      newErrors.welcomeBonus = 'Welcome bonus must be 0-100,000';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreate = async () => {
    if (!validate()) return;
    if (!canAfford) {
      Alert.alert('Insufficient Gold', `You need ${CLUB_CREATION_COST.toLocaleString()} gold to create a club.`);
      return;
    }

    setLoading(true);
    try {
      const club = await createClub({
        name: name.trim(),
        description: description.trim() || undefined,
        privacy: isPrivate ? 'private' : 'public',
        welcome_bonus: parseInt(welcomeBonus) || 0,
      });

      // Update gold balance locally
      updateGoldBalance((user?.gold_balance || 0) - CLUB_CREATION_COST);

      Alert.alert('Success!', `"${club.name}" has been created!`, [
        { text: 'View Club', onPress: () => router.replace(`/club/${club.club_id}`) },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to create club');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerTitle: 'Create Club' }} />
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        {/* Cost Warning */}
        <View style={[styles.costCard, !canAfford && styles.costCardError]}>
          <Ionicons
            name={canAfford ? 'information-circle' : 'warning'}
            size={24}
            color={canAfford ? '#667eea' : '#DC2626'}
          />
          <View style={styles.costInfo}>
            <Text style={styles.costTitle}>Creation Cost</Text>
            <Text style={[styles.costAmount, !canAfford && styles.costAmountError]}>
              {CLUB_CREATION_COST.toLocaleString()} gold
            </Text>
            <Text style={styles.costBalance}>
              Your balance: {(user?.gold_balance || 0).toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Club Name *</Text>
            <TextInput
              style={[styles.input, errors.name && styles.inputError]}
              placeholder="Enter club name"
              placeholderTextColor="#999"
              value={name}
              onChangeText={setName}
              maxLength={50}
              autoCapitalize="words"
            />
            {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Tell people about your club..."
              placeholderTextColor="#999"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              maxLength={500}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.switchRow}>
            <View>
              <Text style={styles.label}>Private Club</Text>
              <Text style={styles.switchHint}>
                {isPrivate ? 'Members need approval to join' : 'Anyone can join'}
              </Text>
            </View>
            <Switch
              value={isPrivate}
              onValueChange={setIsPrivate}
              trackColor={{ false: '#ddd', true: '#667eea' }}
              thumbColor="white"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Welcome Bonus (chips)</Text>
            <TextInput
              style={[styles.input, errors.welcomeBonus && styles.inputError]}
              placeholder="0"
              placeholderTextColor="#999"
              value={welcomeBonus}
              onChangeText={setWelcomeBonus}
              keyboardType="number-pad"
              maxLength={6}
            />
            <Text style={styles.hint}>Chips given to new members when they join</Text>
            {errors.welcomeBonus && <Text style={styles.errorText}>{errors.welcomeBonus}</Text>}
          </View>
        </View>

        {/* Create Button */}
        <TouchableOpacity
          style={[styles.createButton, (!canAfford || loading) && styles.createButtonDisabled]}
          onPress={handleCreate}
          disabled={!canAfford || loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Ionicons name="add-circle" size={24} color="white" />
              <Text style={styles.createButtonText}>Create Club</Text>
            </>
          )}
        </TouchableOpacity>

        {!canAfford && (
          <TouchableOpacity
            style={styles.buyGoldButton}
            onPress={() => router.push('/(tabs)/shop')}
          >
            <Text style={styles.buyGoldText}>Buy More Gold</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  costCard: {
    flexDirection: 'row',
    backgroundColor: '#EEF2FF',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  costCardError: { backgroundColor: '#FEE2E2', borderColor: '#FECACA' },
  costInfo: { marginLeft: 12, flex: 1 },
  costTitle: { fontSize: 14, color: '#666' },
  costAmount: { fontSize: 20, fontWeight: 'bold', color: '#667eea', marginTop: 4 },
  costAmountError: { color: '#DC2626' },
  costBalance: { fontSize: 12, color: '#999', marginTop: 4 },
  form: { padding: 16, gap: 20 },
  inputGroup: { gap: 6 },
  label: { fontSize: 14, fontWeight: '600', color: '#333' },
  input: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    fontSize: 16,
    color: '#333',
  },
  inputError: { borderColor: '#DC2626' },
  textArea: { height: 100, paddingTop: 14 },
  hint: { fontSize: 12, color: '#999', marginTop: 4 },
  errorText: { fontSize: 12, color: '#DC2626', marginTop: 4 },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
  },
  switchHint: { fontSize: 12, color: '#666', marginTop: 4 },
  createButton: {
    flexDirection: 'row',
    backgroundColor: '#667eea',
    marginHorizontal: 16,
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  createButtonDisabled: { backgroundColor: '#ccc' },
  createButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  buyGoldButton: { alignItems: 'center', marginTop: 16 },
  buyGoldText: { color: '#667eea', fontSize: 16, fontWeight: '600' },
});
