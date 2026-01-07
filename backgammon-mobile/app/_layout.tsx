import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../store/authStore';
import { useWebSocket } from '../hooks/useWebSocket';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

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

  // Initialize WebSocket connection when authenticated
  useWebSocket();

  // Monitor network status
  useNetworkStatus(true);

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
    <ErrorBoundary>
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

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
});
