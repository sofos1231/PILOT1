# 📱 LANE 2: FRONTEND EXPO (FIXED)
## React Native + Expo Go Mobile Application
## ✅ ALL ISSUES PATCHED

---

## YOUR MISSION
Build the complete mobile frontend:
- Expo + React Native project
- Expo Router navigation
- Authentication screens
- Tab navigation
- State management with Zustand

---

## PHASE 1: Project Setup

### Step 1.1: Create Expo Project
```bash
cd /home/claude
npx create-expo-app@latest backgammon-mobile --template expo-template-blank-typescript
cd backgammon-mobile
```

### Step 1.2: Install Expo Router
```bash
npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar react-native-gesture-handler
```

### Step 1.3: Install State Management & API
```bash
npm install zustand axios socket.io-client
npx expo install @react-native-async-storage/async-storage
```

### Step 1.4: Install UI Libraries
```bash
npx expo install react-native-svg expo-linear-gradient @expo/vector-icons
```

### Step 1.5: Update package.json
Replace the scripts and main in `package.json`:
```json
{
  "name": "backgammon-mobile",
  "version": "1.0.0",
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web"
  },
  "dependencies": {
    "@expo/vector-icons": "^14.0.0",
    "@react-native-async-storage/async-storage": "1.23.1",
    "axios": "^1.6.0",
    "expo": "~51.0.0",
    "expo-constants": "~16.0.0",
    "expo-linear-gradient": "~13.0.0",
    "expo-linking": "~6.3.0",
    "expo-router": "~3.5.0",
    "expo-status-bar": "~1.12.0",
    "react": "18.2.0",
    "react-native": "0.74.0",
    "react-native-gesture-handler": "~2.16.0",
    "react-native-safe-area-context": "4.10.0",
    "react-native-screens": "3.31.0",
    "react-native-svg": "15.2.0",
    "socket.io-client": "^4.7.0",
    "zustand": "^4.5.0"
  },
  "devDependencies": {
    "@babel/core": "^7.20.0",
    "@types/react": "~18.2.0",
    "typescript": "~5.3.0"
  }
}
```

### Step 1.6: Update app.json
Replace `app.json` completely:
```json
{
  "expo": {
    "name": "Backgammon Club",
    "slug": "backgammon-club",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#667eea"
    },
    "assetBundlePatterns": ["**/*"],
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.backgammonclub.app"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#667eea"
      },
      "package": "com.backgammonclub.app"
    },
    "scheme": "backgammonclub",
    "plugins": ["expo-router"],
    "experiments": {
      "typedRoutes": true
    }
  }
}
```

### Step 1.7: Create Directory Structure (FIXED - includes hooks)
```bash
mkdir -p app/\(auth\)
mkdir -p app/\(tabs\)
mkdir -p app/match
mkdir -p app/club
mkdir -p components/common
mkdir -p components/game
mkdir -p components/club
mkdir -p store
mkdir -p services/api
mkdir -p types
mkdir -p utils
mkdir -p hooks
mkdir -p config
```

---

## PHASE 2: Configuration (FIXED - Proper API URL handling)

### Step 2.1: Create Config File
Create `config/api.config.ts`:
```typescript
import { Platform } from 'react-native';

/**
 * API Configuration
 * 
 * IMPORTANT: Before testing on your phone, you MUST update API_HOST!
 * 
 * To find your computer's IP address:
 * - Windows: Open cmd, run "ipconfig", look for "IPv4 Address"
 * - Mac/Linux: Open terminal, run "ifconfig", look for "inet" under en0 or eth0
 * 
 * Example: If your IP is 192.168.1.100, set API_HOST = '192.168.1.100'
 */

// ⚠️ CHANGE THIS TO YOUR COMPUTER'S IP ADDRESS
const API_HOST = '192.168.1.100'; // <-- UPDATE THIS!
const API_PORT = '8000';

// For Android emulator, use 10.0.2.2 to reach localhost
// For iOS simulator, localhost works
// For physical devices, use your computer's local IP
const getBaseUrl = () => {
  if (__DEV__) {
    // Development
    if (Platform.OS === 'android') {
      // Android emulator uses 10.0.2.2 to reach host machine
      // But for physical device, we need actual IP
      return `http://${API_HOST}:${API_PORT}/v1`;
    }
    return `http://${API_HOST}:${API_PORT}/v1`;
  }
  // Production - replace with your actual production URL
  return 'https://api.backgammonclub.com/v1';
};

export const API_CONFIG = {
  BASE_URL: getBaseUrl(),
  TIMEOUT: 15000, // 15 seconds
  WS_URL: `http://${API_HOST}:${API_PORT}`,
};

// Log the URL in development for debugging
if (__DEV__) {
  console.log('🔗 API Base URL:', API_CONFIG.BASE_URL);
  console.log('🔌 WebSocket URL:', API_CONFIG.WS_URL);
}
```

---

## PHASE 3: State Management

### Step 3.1: Create Auth Store
Create `store/authStore.ts`:
```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface User {
  user_id: string;
  username: string;
  email: string;
  avatar_url: string | null;
  gold_balance: number;
  level: number;
  xp: number;
  total_matches: number;
  wins: number;
  losses: number;
  country: string | null;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isHydrated: boolean;
  
  // Actions
  login: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  setUser: (user: User) => void;
  setLoading: (loading: boolean) => void;
  setHydrated: (hydrated: boolean) => void;
  updateGoldBalance: (balance: number) => void;
  updateTokens: (accessToken: string, refreshToken: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: true,
      isHydrated: false,
      
      login: (user, accessToken, refreshToken) => {
        set({ 
          user, 
          accessToken, 
          refreshToken, 
          isAuthenticated: true,
          isLoading: false,
        });
      },
      
      logout: () => {
        set({ 
          user: null, 
          accessToken: null, 
          refreshToken: null, 
          isAuthenticated: false,
          isLoading: false,
        });
      },
      
      setUser: (user) => set({ user }),
      
      setLoading: (isLoading) => set({ isLoading }),
      
      setHydrated: (isHydrated) => set({ isHydrated }),
      
      updateGoldBalance: (gold_balance) => {
        const user = get().user;
        if (user) {
          set({ user: { ...user, gold_balance } });
        }
      },
      
      updateTokens: (accessToken, refreshToken) => {
        set({ accessToken, refreshToken });
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        // Called when storage is rehydrated
        if (state) {
          state.setHydrated(true);
          state.setLoading(false);
        }
      },
      partialize: (state) => ({
        // Only persist these fields
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
```

### Step 3.2: Create API Client (FIXED - uses config)
Create `services/api/axiosInstance.ts`:
```typescript
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_CONFIG } from '../../config/api.config';
import { useAuthStore } from '../../store/authStore';

// Create axios instance with config
const apiClient = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const { accessToken } = useAuthStore.getState();
    if (accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    
    // Log requests in development
    if (__DEV__) {
      console.log(`📤 ${config.method?.toUpperCase()} ${config.url}`);
    }
    
    return config;
  },
  (error) => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor - handle token refresh and errors
apiClient.interceptors.response.use(
  (response) => {
    if (__DEV__) {
      console.log(`📥 ${response.status} ${response.config.url}`);
    }
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    
    // Log error in development
    if (__DEV__) {
      console.error(`❌ ${error.response?.status || 'Network Error'} ${originalRequest?.url}`, error.message);
    }
    
    // Handle 401 - try to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      const { refreshToken, updateTokens, logout, user } = useAuthStore.getState();
      
      if (!refreshToken) {
        logout();
        return Promise.reject(error);
      }
      
      try {
        // Use fresh axios instance to avoid interceptors
        const { data } = await axios.post(
          `${API_CONFIG.BASE_URL}/auth/refresh`,
          { refresh_token: refreshToken },
          { timeout: API_CONFIG.TIMEOUT }
        );
        
        // Update tokens in store
        updateTokens(data.access_token, data.refresh_token);
        
        // Retry original request with new token
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
        }
        
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed - logout user
        console.error('Token refresh failed:', refreshError);
        logout();
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;
```

### Step 3.3: Create Auth API Service
Create `services/api/authApi.ts`:
```typescript
import apiClient from './axiosInstance';
import { User } from '../../store/authStore';

export interface RegisterData {
  email: string;
  username: string;
  password: string;
  country: string;
  age_confirmed: boolean;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  user: User;
  access_token: string;
  refresh_token: string;
}

export const authApi = {
  register: (data: RegisterData) => 
    apiClient.post<AuthResponse>('/auth/register', data),
  
  login: (data: LoginData) => 
    apiClient.post<AuthResponse>('/auth/login', data),
  
  refresh: (refreshToken: string) => 
    apiClient.post<{ access_token: string; refresh_token: string }>('/auth/refresh', { 
      refresh_token: refreshToken 
    }),
  
  logout: () => 
    apiClient.post('/auth/logout'),
  
  getProfile: () => 
    apiClient.get<{ success: boolean; user: User }>('/auth/profile'),
};
```

---

## PHASE 4: Navigation & Screens

### Step 4.1: Create Root Layout (FIXED - proper hydration handling)
Create `app/_layout.tsx`:
```typescript
import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../store/authStore';

function LoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#667eea" />
    </View>
  );
}

export default function RootLayout() {
  const { isAuthenticated, isLoading, isHydrated } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const [isNavigationReady, setNavigationReady] = useState(false);

  // Handle navigation based on auth state
  useEffect(() => {
    if (!isHydrated || isLoading || !isNavigationReady) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect to welcome if not authenticated
      router.replace('/(auth)/welcome');
    } else if (isAuthenticated && inAuthGroup) {
      // Redirect to home if authenticated
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, segments, isHydrated, isLoading, isNavigationReady]);

  // Show loading while hydrating
  if (!isHydrated || isLoading) {
    return <LoadingScreen />;
  }

  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{ headerShown: false }}
        onLayout={() => setNavigationReady(true)}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen 
          name="match/[id]" 
          options={{ 
            presentation: 'fullScreenModal',
            headerShown: false,
          }} 
        />
        <Stack.Screen 
          name="club/[id]" 
          options={{ 
            headerShown: true,
            headerBackTitle: 'Back',
          }} 
        />
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
});
```

### Step 4.2: Create Auth Layout
Create `app/(auth)/_layout.tsx`:
```typescript
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
    </Stack>
  );
}
```

### Step 4.3: Create Tab Layout
Create `app/(tabs)/_layout.tsx`:
```typescript
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAuthStore } from '../../store/authStore';

export default function TabLayout() {
  const user = useAuthStore((state) => state.user);

  const GoldDisplay = () => (
    <View style={styles.goldContainer}>
      <Text style={styles.goldIcon}>🪙</Text>
      <Text style={styles.goldBalance}>
        {(user?.gold_balance ?? 0).toLocaleString()}
      </Text>
    </View>
  );

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#667eea',
        tabBarInactiveTintColor: '#999',
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
        headerStyle: styles.header,
        headerTitleStyle: styles.headerTitle,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Play',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="game-controller" size={size} color={color} />
          ),
          headerTitle: 'Backgammon Club',
          headerRight: () => <GoldDisplay />,
        }}
      />
      
      <Tabs.Screen
        name="clubs"
        options={{
          title: 'Clubs',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people" size={size} color={color} />
          ),
          headerRight: () => <GoldDisplay />,
        }}
      />
      
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: 'Rankings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trophy" size={size} color={color} />
          ),
        }}
      />
      
      <Tabs.Screen
        name="shop"
        options={{
          title: 'Shop',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cart" size={size} color={color} />
          ),
          headerRight: () => <GoldDisplay />,
        }}
      />
      
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    height: 60,
    paddingBottom: 8,
    paddingTop: 8,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  header: {
    backgroundColor: '#fff',
    elevation: 0,
    shadowOpacity: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontWeight: 'bold',
    fontSize: 18,
  },
  goldContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    backgroundColor: '#FFF8E1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  goldIcon: {
    fontSize: 16,
    marginRight: 4,
  },
  goldBalance: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#F9A825',
  },
});
```

### Step 4.4: Create Welcome Screen
Create `app/(auth)/welcome.tsx`:
```typescript
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';

export default function Welcome() {
  const router = useRouter();

  return (
    <LinearGradient
      colors={['#667eea', '#764ba2']}
      style={styles.container}
    >
      <StatusBar style="light" />
      <View style={styles.content}>
        <Text style={styles.emoji}>🎲</Text>
        <Text style={styles.title}>Backgammon Club</Text>
        <Text style={styles.subtitle}>Play. Compete. Win.</Text>
        
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={() => router.push('/(auth)/register')}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>Get Started</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={() => router.push('/(auth)/login')}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryButtonText}>I Have an Account</Text>
          </TouchableOpacity>
        </View>
        
        <Text style={styles.footer}>
          🎁 Get 10,000 Gold FREE when you sign up!
        </Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emoji: {
    fontSize: 80,
    marginBottom: 16,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 60,
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 300,
    gap: 16,
  },
  button: {
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 30,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: 'white',
  },
  primaryButtonText: {
    color: '#667eea',
    fontSize: 18,
    fontWeight: 'bold',
  },
  secondaryButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  footer: {
    position: 'absolute',
    bottom: 50,
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});
```

### Step 4.5: Create Register Screen (FIXED - better error handling)
Create `app/(auth)/register.tsx`:
```typescript
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
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { authApi } from '../../services/api/authApi';
import { AxiosError } from 'axios';

interface FormData {
  email: string;
  username: string;
  password: string;
  country: string;
}

export default function Register() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  
  const [formData, setFormData] = useState<FormData>({
    email: '',
    username: '',
    password: '',
    country: 'USA',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Invalid email format';
    }
    
    if (!formData.username.trim()) {
      errors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      errors.username = 'Username must be at least 3 characters';
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      errors.username = 'Username can only contain letters, numbers, and underscores';
    }
    
    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }
    
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    setError('');
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    
    try {
      const { data } = await authApi.register({
        ...formData,
        email: formData.email.toLowerCase().trim(),
        username: formData.username.trim(),
        age_confirmed: true,
      });
      
      login(data.user, data.access_token, data.refresh_token);
      // Navigation will happen automatically via _layout.tsx
      
    } catch (err) {
      const axiosError = err as AxiosError<{ error: string; details?: Array<{ field: string; message: string }> }>;
      
      if (axiosError.response?.data?.details) {
        // Handle validation errors from server
        const serverErrors: Record<string, string> = {};
        axiosError.response.data.details.forEach((detail) => {
          serverErrors[detail.field] = detail.message;
        });
        setFieldErrors(serverErrors);
      } else if (axiosError.response?.data?.error) {
        setError(axiosError.response.data.error);
      } else if (axiosError.message === 'Network Error') {
        setError('Cannot connect to server. Please check your connection and make sure the backend is running.');
      } else {
        setError('Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: keyof FormData, value: string) => {
    setFormData({ ...formData, [field]: value });
    // Clear field error when user starts typing
    if (fieldErrors[field]) {
      setFieldErrors({ ...fieldErrors, [field]: '' });
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
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Join the club and start playing!</Text>
        
        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
        
        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, fieldErrors.email && styles.inputError]}
              placeholder="your@email.com"
              placeholderTextColor="#999"
              value={formData.email}
              onChangeText={(value) => updateField('email', value)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              editable={!loading}
            />
            {fieldErrors.email && (
              <Text style={styles.fieldError}>{fieldErrors.email}</Text>
            )}
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={[styles.input, fieldErrors.username && styles.inputError]}
              placeholder="Choose a username"
              placeholderTextColor="#999"
              value={formData.username}
              onChangeText={(value) => updateField('username', value)}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
            {fieldErrors.username && (
              <Text style={styles.fieldError}>{fieldErrors.username}</Text>
            )}
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={[styles.input, fieldErrors.password && styles.inputError]}
              placeholder="At least 8 characters"
              placeholderTextColor="#999"
              value={formData.password}
              onChangeText={(value) => updateField('password', value)}
              secureTextEntry
              editable={!loading}
            />
            {fieldErrors.password && (
              <Text style={styles.fieldError}>{fieldErrors.password}</Text>
            )}
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
              <Text style={styles.buttonText}>Create Account</Text>
            )}
          </TouchableOpacity>
        </View>
        
        <View style={styles.bonusContainer}>
          <Text style={styles.bonusText}>🎁 Get 10,000 Gold FREE on signup!</Text>
        </View>
        
        <TouchableOpacity 
          onPress={() => router.push('/(auth)/login')}
          style={styles.linkContainer}
          disabled={loading}
        >
          <Text style={styles.linkText}>
            Already have an account? <Text style={styles.linkTextBold}>Login</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 60,
  },
  backButton: {
    marginBottom: 20,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    color: '#667eea',
    fontSize: 16,
    fontWeight: '500',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
  },
  errorContainer: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#DC2626',
    textAlign: 'center',
    fontSize: 14,
  },
  form: {
    gap: 16,
  },
  inputContainer: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
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
  inputError: {
    borderColor: '#DC2626',
  },
  fieldError: {
    color: '#DC2626',
    fontSize: 12,
    marginTop: 4,
  },
  button: {
    backgroundColor: '#667eea',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonDisabled: {
    backgroundColor: '#999',
    shadowOpacity: 0,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  bonusContainer: {
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    marginTop: 24,
    alignItems: 'center',
  },
  bonusText: {
    color: '#92400E',
    fontWeight: '600',
    fontSize: 14,
  },
  linkContainer: {
    marginTop: 24,
    alignItems: 'center',
    paddingBottom: 24,
  },
  linkText: {
    color: '#666',
    fontSize: 16,
  },
  linkTextBold: {
    color: '#667eea',
    fontWeight: 'bold',
  },
});
```

### Step 4.6: Create Login Screen
Create `app/(auth)/login.tsx`:
```typescript
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
      // Navigation will happen automatically via _layout.tsx
      
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
```

### Step 4.7: Create Home/Play Tab
Create `app/(tabs)/index.tsx`:
```typescript
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { Ionicons } from '@expo/vector-icons';

export default function PlayTab() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Welcome Card */}
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

      {/* Quick Match Button */}
      <TouchableOpacity 
        style={styles.quickMatchButton}
        activeOpacity={0.9}
        onPress={() => {
          // Will be implemented in Lane 3
          console.log('Quick match pressed');
        }}
      >
        <Ionicons name="flash" size={28} color="white" />
        <Text style={styles.quickMatchText}>Quick Match</Text>
        <Text style={styles.quickMatchSubtext}>Find an opponent now</Text>
      </TouchableOpacity>

      {/* Options Grid */}
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

      {/* Recent Matches (Placeholder) */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Matches</Text>
        <View style={styles.emptyState}>
          <Ionicons name="dice-outline" size={48} color="#ccc" />
          <Text style={styles.emptyStateText}>No matches yet</Text>
          <Text style={styles.emptyStateSubtext}>Play your first game!</Text>
        </View>
      </View>
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
});
```

### Step 4.8: Create ALL Placeholder Tabs (FIXED - all files provided)

Create `app/(tabs)/clubs.tsx`:
```typescript
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function ClubsTab() {
  return (
    <View style={styles.container}>
      <Ionicons name="people" size={64} color="#667eea" />
      <Text style={styles.title}>Clubs</Text>
      <Text style={styles.subtitle}>Join or create a club to play with friends!</Text>
      <Text style={styles.comingSoon}>Coming in Lane 6</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5', padding: 24 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#333', marginTop: 16 },
  subtitle: { fontSize: 16, color: '#666', marginTop: 8, textAlign: 'center' },
  comingSoon: { fontSize: 14, color: '#667eea', marginTop: 24, fontWeight: '500' },
});
```

Create `app/(tabs)/leaderboard.tsx`:
```typescript
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function LeaderboardTab() {
  return (
    <View style={styles.container}>
      <Ionicons name="trophy" size={64} color="#F9A825" />
      <Text style={styles.title}>Leaderboard</Text>
      <Text style={styles.subtitle}>See how you rank against other players!</Text>
      <Text style={styles.comingSoon}>Coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5', padding: 24 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#333', marginTop: 16 },
  subtitle: { fontSize: 16, color: '#666', marginTop: 8, textAlign: 'center' },
  comingSoon: { fontSize: 14, color: '#667eea', marginTop: 24, fontWeight: '500' },
});
```

Create `app/(tabs)/shop.tsx`:
```typescript
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
```

Create `app/(tabs)/profile.tsx`:
```typescript
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
      {/* Avatar */}
      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.username?.charAt(0).toUpperCase() ?? '?'}
          </Text>
        </View>
        <Text style={styles.username}>{user?.username ?? 'Player'}</Text>
        <Text style={styles.email}>{user?.email ?? ''}</Text>
      </View>

      {/* Stats Card */}
      <View style={styles.statsCard}>
        <View style={styles.statRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{user?.gold_balance?.toLocaleString() ?? 0}</Text>
            <Text style={styles.statLabel}>🪙 Gold</Text>
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

      {/* Logout Button */}
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
```

---

## PHASE 5: Testing

### Step 5.1: Update API Config
**⚠️ IMPORTANT**: Before testing, update `config/api.config.ts` with your computer's IP address:
```typescript
const API_HOST = '192.168.1.XXX'; // Your actual IP
```

### Step 5.2: Start Development Server
```bash
cd /home/claude/backgammon-mobile
npx expo start
```

### Step 5.3: Test on Phone
1. Install **Expo Go** app from App Store or Google Play
2. Scan QR code from terminal with your phone camera
3. App opens in Expo Go!

### Step 5.4: Test Flow
1. ✅ App loads without crash
2. ✅ Welcome screen appears
3. ✅ Can navigate to Register
4. ✅ Can fill registration form
5. ✅ Registration succeeds (connects to backend)
6. ✅ Redirected to home tab after registration
7. ✅ All 5 tabs are accessible
8. ✅ User info displays correctly
9. ✅ Gold balance shows in header
10. ✅ Can logout and login again

---

## ✅ LANE 2 COMPLETION CHECKLIST

- [ ] Expo project created with correct dependencies
- [ ] app.json configured correctly
- [ ] All directories created (including hooks, config)
- [ ] API config file created with instructions
- [ ] Auth store implemented with proper hydration
- [ ] API client with interceptors and error handling
- [ ] Root layout with auth state handling
- [ ] Auth layout for welcome/login/register
- [ ] Tab layout with 5 tabs and gold display
- [ ] Welcome screen complete
- [ ] Register screen with validation
- [ ] Login screen complete
- [ ] Home/Play tab complete
- [ ] Clubs tab placeholder
- [ ] Leaderboard tab placeholder
- [ ] Shop tab placeholder
- [ ] Profile tab with logout
- [ ] App runs in Expo Go without errors
- [ ] Registration connects to backend
- [ ] Login works correctly
- [ ] Auth state persists after app restart

**When all items are checked, LANE 2 IS COMPLETE!**

---

## 📁 FILES CREATED IN LANE 2

```
backgammon-mobile/
├── app.json
├── package.json
├── config/
│   └── api.config.ts
├── app/
│   ├── _layout.tsx
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   ├── welcome.tsx
│   │   ├── login.tsx
│   │   └── register.tsx
│   └── (tabs)/
│       ├── _layout.tsx
│       ├── index.tsx
│       ├── clubs.tsx
│       ├── leaderboard.tsx
│       ├── shop.tsx
│       └── profile.tsx
├── store/
│   └── authStore.ts
├── services/
│   └── api/
│       ├── axiosInstance.ts
│       └── authApi.ts
├── hooks/
│   └── (empty - for Lane 4)
├── types/
│   └── (empty - for Lane 3)
└── components/
    └── (empty - for Lane 3)
```
