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
const API_HOST = '10.0.0.14'; // <-- UPDATE THIS!
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
