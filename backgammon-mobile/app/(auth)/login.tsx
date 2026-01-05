import { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { authApi } from '../../services/api/authApi';
import { AxiosError } from 'axios';

export default function Login() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!formData.email.trim() || !formData.password) {
      setError('Please fill in all fields');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const { data } = await authApi.login({
        email: formData.email.toLowerCase().trim(),
        password: formData.password,
      });
      
      login(data.user, data.access_token, data.refresh_token);
      
    } catch (err) {
      const axiosError = err as AxiosError<{ error: string }>;
      
      if (axiosError.response?.data?.error) {
        setError(axiosError.response.data.error);
      } else if (axiosError.message === 'Network Error') {
        setError('Cannot connect to server. Please check your connection.');
      } else {
        setError('Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        
        <Text style={styles.title}>Welcome Back!</Text>
        <Text style={styles.subtitle}>Login to continue playing</Text>
        
        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
        
        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="your@email.com"
              placeholderTextColor="#999"
              value={formData.email}
              onChangeText={(email) => setFormData({ ...formData, email })}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              editable={!loading}
            />
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Your password"
              placeholderTextColor="#999"
              value={formData.password}
              onChangeText={(password) => setFormData({ ...formData, password })}
              secureTextEntry
              editable={!loading}
            />
          </View>
          
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.buttonText}>Login</Text>
            )}
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity 
          onPress={() => router.push('/(auth)/register')}
          style={styles.linkContainer}
          disabled={loading}
        >
          <Text style={styles.linkText}>
            Don't have an account? <Text style={styles.linkTextBold}>Sign Up</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scrollContent: { flexGrow: 1, padding: 24, paddingTop: 60 },
  backButton: { marginBottom: 20, alignSelf: 'flex-start' },
  backButtonText: { color: '#667eea', fontSize: 16, fontWeight: '500' },
  title: { fontSize: 32, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 32 },
  errorContainer: { backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FECACA', padding: 12, borderRadius: 8, marginBottom: 16 },
  errorText: { color: '#DC2626', textAlign: 'center', fontSize: 14 },
  form: { gap: 16 },
  inputContainer: { gap: 6 },
  label: { fontSize: 14, fontWeight: '600', color: '#333' },
  input: { backgroundColor: 'white', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#ddd', fontSize: 16, color: '#333' },
  button: { backgroundColor: '#667eea', paddingVertical: 18, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  buttonDisabled: { backgroundColor: '#999' },
  buttonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  linkContainer: { marginTop: 24, alignItems: 'center' },
  linkText: { color: '#666', fontSize: 16 },
  linkTextBold: { color: '#667eea', fontWeight: 'bold' },
});
