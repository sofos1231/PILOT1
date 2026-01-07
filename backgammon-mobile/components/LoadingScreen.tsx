import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';

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
