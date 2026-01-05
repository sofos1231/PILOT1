import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function ShopTab() {
  return (
    <View style={styles.container}>
      <Ionicons name="cart" size={64} color="#10B981" />
      <Text style={styles.title}>Gold Shop</Text>
      <Text style={styles.subtitle}>Purchase gold to play more games!</Text>
      <Text style={styles.comingSoon}>Coming in Lane 5</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5', padding: 24 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#333', marginTop: 16 },
  subtitle: { fontSize: 16, color: '#666', marginTop: 8, textAlign: 'center' },
  comingSoon: { fontSize: 14, color: '#667eea', marginTop: 24, fontWeight: '500' },
});
