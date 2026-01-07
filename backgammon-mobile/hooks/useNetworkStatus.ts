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
