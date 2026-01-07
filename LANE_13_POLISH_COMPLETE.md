# ✨ LANE 13: POLISH & ERROR HANDLING - COMPLETE
## Add Error Boundaries, Loading States, and UX Polish
## Copy-Paste Ready Code

---

## OVERVIEW

**Problem:**
- No error boundaries to catch crashes
- Inconsistent loading states
- No network error handling
- Missing empty states in some screens

**Solution:**
- Create ErrorBoundary component
- Create EmptyState component
- Add network status hook
- Improve overall polish

**Time:** 45 minutes

**Prerequisites:**
- Lanes 8-12 complete
- App running in Expo

---

## PHASE 1: Create Error Boundary

### Step 1.1: Create ErrorBoundary.tsx

Create file `components/ErrorBoundary.tsx`:

```typescript
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
    
    // Here you could send to an error reporting service like Sentry
    // Sentry.captureException(error);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.container}>
          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <Ionicons name="bug-outline" size={64} color="#DC2626" />
            </View>
            
            <Text style={styles.title}>Oops! Something went wrong</Text>
            <Text style={styles.message}>
              We're sorry, but something unexpected happened. Please try again.
            </Text>

            <TouchableOpacity style={styles.button} onPress={this.handleReset}>
              <Ionicons name="refresh" size={20} color="white" />
              <Text style={styles.buttonText}>Try Again</Text>
            </TouchableOpacity>

            {__DEV__ && this.state.error && (
              <ScrollView style={styles.errorDetails}>
                <Text style={styles.errorTitle}>Error Details (Dev Only):</Text>
                <Text style={styles.errorText}>{this.state.error.toString()}</Text>
                {this.state.errorInfo && (
                  <Text style={styles.errorStack}>
                    {this.state.errorInfo.componentStack}
                  </Text>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    alignItems: 'center',
    maxWidth: 320,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#667eea',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  errorDetails: {
    marginTop: 24,
    padding: 12,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    maxHeight: 200,
    width: '100%',
  },
  errorTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#DC2626',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 11,
    color: '#DC2626',
    fontFamily: 'monospace',
  },
  errorStack: {
    fontSize: 10,
    color: '#B91C1C',
    marginTop: 8,
    fontFamily: 'monospace',
  },
});

export default ErrorBoundary;
```

---

## PHASE 2: Create Empty State Component

### Step 2.1: Create EmptyState.tsx

Create file `components/EmptyState.tsx`:

```typescript
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  actionText?: string;
  onAction?: () => void;
  iconColor?: string;
  iconBackground?: string;
}

export function EmptyState({
  icon,
  title,
  message,
  actionText,
  onAction,
  iconColor = '#9CA3AF',
  iconBackground = '#F3F4F6',
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={[styles.iconContainer, { backgroundColor: iconBackground }]}>
        <Ionicons name={icon} size={48} color={iconColor} />
      </View>
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
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  button: {
    backgroundColor: '#667eea',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    marginTop: 24,
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
});

export default EmptyState;
```

---

## PHASE 3: Create Loading Component

### Step 3.1: Create LoadingScreen.tsx

Create file `components/LoadingScreen.tsx`:

```typescript
import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface LoadingScreenProps {
  message?: string;
  fullScreen?: boolean;
}

export function LoadingScreen({ message = 'Loading...', fullScreen = true }: LoadingScreenProps) {
  const content = (
    <View style={styles.content}>
      <ActivityIndicator size="large" color="#667eea" />
      <Text style={styles.message}>{message}</Text>
    </View>
  );

  if (fullScreen) {
    return <View style={styles.container}>{content}</View>;
  }

  return content;
}

export function LoadingOverlay({ message = 'Please wait...' }: LoadingScreenProps) {
  return (
    <View style={styles.overlay}>
      <View style={styles.overlayContent}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.overlayMessage}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  content: {
    alignItems: 'center',
    padding: 24,
  },
  message: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  overlayContent: {
    backgroundColor: 'white',
    paddingHorizontal: 40,
    paddingVertical: 30,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 10,
  },
  overlayMessage: {
    marginTop: 16,
    fontSize: 14,
    color: '#374151',
  },
});

export default LoadingScreen;
```

---

## PHASE 4: Create Network Status Hook

### Step 4.1: Create useNetworkStatus.ts

Create file `hooks/useNetworkStatus.ts`:

```typescript
import { useState, useEffect } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { Alert } from 'react-native';

interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: string;
}

export function useNetworkStatus(showAlerts: boolean = true) {
  const [status, setStatus] = useState<NetworkStatus>({
    isConnected: true,
    isInternetReachable: true,
    type: 'unknown',
  });
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const isConnected = state.isConnected ?? false;
      const isInternetReachable = state.isInternetReachable;
      const type = state.type;

      setStatus({
        isConnected,
        isInternetReachable,
        type,
      });

      if (showAlerts) {
        // Show alert when going offline
        if (!isConnected && !wasOffline) {
          setWasOffline(true);
          Alert.alert(
            'No Connection',
            'You appear to be offline. Some features may not work.',
            [{ text: 'OK' }]
          );
        }

        // Show alert when coming back online
        if (isConnected && wasOffline) {
          setWasOffline(false);
          Alert.alert(
            'Back Online',
            'Your connection has been restored.',
            [{ text: 'OK' }]
          );
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [showAlerts, wasOffline]);

  return status;
}

export default useNetworkStatus;
```

**Note:** You need to install the NetInfo package if not already installed:

```bash
npx expo install @react-native-community/netinfo
```

---

## PHASE 5: Create Toast/Notification Component

### Step 5.1: Create Toast.tsx

Create file `components/Toast.tsx`:

```typescript
import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  visible: boolean;
  message: string;
  type?: ToastType;
  duration?: number;
  onHide: () => void;
}

const toastConfig: Record<ToastType, { bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  success: { bg: '#10B981', icon: 'checkmark-circle' },
  error: { bg: '#EF4444', icon: 'close-circle' },
  warning: { bg: '#F59E0B', icon: 'warning' },
  info: { bg: '#667eea', icon: 'information-circle' },
};

export function Toast({
  visible,
  message,
  type = 'info',
  duration = 3000,
  onHide,
}: ToastProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 15,
        }),
      ]).start();

      const timer = setTimeout(() => {
        hideToast();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onHide();
    });
  };

  if (!visible) return null;

  const config = toastConfig[type];

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: config.bg },
        { opacity: fadeAnim, transform: [{ translateY }] },
      ]}
    >
      <Ionicons name={config.icon} size={24} color="white" />
      <Text style={styles.message} numberOfLines={2}>
        {message}
      </Text>
      <TouchableOpacity onPress={hideToast} style={styles.closeButton}>
        <Ionicons name="close" size={20} color="rgba(255,255,255,0.8)" />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 9999,
    gap: 12,
  },
  message: {
    flex: 1,
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  closeButton: {
    padding: 4,
  },
});

export default Toast;
```

---

## PHASE 6: Update Root Layout with Error Boundary

### Step 6.1: Update app/_layout.tsx

Wrap your app with the ErrorBoundary. Update `app/_layout.tsx`:

```typescript
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../store/authStore';
import { useWebSocket } from '../hooks/useWebSocket';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

export default function RootLayout() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrated = useAuthStore((state) => state.isHydrated);

  // Initialize WebSocket when authenticated
  useWebSocket();

  // Monitor network status
  useNetworkStatus(true);

  if (!isHydrated) {
    return null; // Or a splash screen
  }

  return (
    <ErrorBoundary>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="match/[id]"
          options={{
            headerShown: true,
            headerTitle: 'Match',
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="club/[id]"
          options={{
            headerShown: true,
            headerTitle: 'Club',
          }}
        />
        <Stack.Screen
          name="club/create"
          options={{
            headerShown: true,
            headerTitle: 'Create Club',
            presentation: 'modal',
          }}
        />
      </Stack>
    </ErrorBoundary>
  );
}
```

---

## PHASE 7: Create Components Index

### Step 7.1: Create components/index.ts

Create file `components/index.ts`:

```typescript
export { ErrorBoundary } from './ErrorBoundary';
export { EmptyState } from './EmptyState';
export { LoadingScreen, LoadingOverlay } from './LoadingScreen';
export { Toast } from './Toast';
```

---

## ✅ LANE 13 VERIFICATION CHECKLIST

After implementing, verify:

- [ ] ErrorBoundary.tsx exists in components/
- [ ] EmptyState.tsx exists in components/
- [ ] LoadingScreen.tsx exists in components/
- [ ] Toast.tsx exists in components/
- [ ] useNetworkStatus.ts exists in hooks/
- [ ] Root layout wrapped with ErrorBoundary
- [ ] App doesn't crash on component errors
- [ ] Offline/online alerts work
- [ ] Loading states are consistent

---

## 📁 FILES CREATED/MODIFIED

| File | Action |
|------|--------|
| `components/ErrorBoundary.tsx` | CREATE |
| `components/EmptyState.tsx` | CREATE |
| `components/LoadingScreen.tsx` | CREATE |
| `components/Toast.tsx` | CREATE |
| `components/index.ts` | CREATE |
| `hooks/useNetworkStatus.ts` | CREATE |
| `app/_layout.tsx` | UPDATE |

---

## 🚀 READY FOR LANE 14

After Lane 13 is complete:
- Error boundaries catch crashes
- Reusable UI components ready
- Network status monitoring active
- Better user experience

Proceed to **Lane 14: Testing & Bug Fixes**
