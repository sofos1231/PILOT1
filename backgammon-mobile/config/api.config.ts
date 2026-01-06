import { Platform } from 'react-native';

/**
 * API Configuration
 *
 * DEVELOPMENT SETUP:
 * Before testing on your phone, you MUST update DEV_API_HOST!
 *
 * To find your computer's IP address:
 * - Windows: Open cmd, run "ipconfig", look for "IPv4 Address"
 * - Mac/Linux: Open terminal, run "ifconfig", look for "inet" under en0 or eth0
 *
 * Example: If your IP is 192.168.1.100, set DEV_API_HOST = '192.168.1.100'
 *
 * PRODUCTION SETUP:
 * Update PROD_API_HOST and PROD_WS_HOST with your production server URLs
 */

// ==================== DEVELOPMENT CONFIG ====================
const DEV_API_HOST = '10.0.0.71'; // <-- UPDATE THIS with your local IP!
const DEV_API_PORT = '8000';

// ==================== PRODUCTION CONFIG ====================
const PROD_API_HOST = 'api.backgammonclub.com'; // <-- UPDATE for production
const PROD_WS_HOST = 'api.backgammonclub.com';  // <-- UPDATE for production

// ==================== URL GENERATORS ====================
const getBaseUrl = (): string => {
  if (__DEV__) {
    // Development - use local server
    return `http://${DEV_API_HOST}:${DEV_API_PORT}/v1`;
  }
  // Production - use HTTPS
  return `https://${PROD_API_HOST}/v1`;
};

const getWebSocketUrl = (): string => {
  if (__DEV__) {
    // Development - use local server
    return `http://${DEV_API_HOST}:${DEV_API_PORT}`;
  }
  // Production - use WSS (secure WebSocket)
  return `wss://${PROD_WS_HOST}`;
};

// ==================== EXPORTED CONFIG ====================
export const API_CONFIG = {
  BASE_URL: getBaseUrl(),
  WS_URL: getWebSocketUrl(),
  TIMEOUT: 15000, // 15 seconds

  // Feature flags
  ENABLE_LOGGING: __DEV__,
  ENABLE_MOCK_DATA: false,
};

// Platform-specific adjustments
export const PLATFORM_CONFIG = {
  isAndroid: Platform.OS === 'android',
  isIOS: Platform.OS === 'ios',
  // Android emulator uses 10.0.2.2 for localhost
  ANDROID_EMULATOR_LOCALHOST: '10.0.2.2',
};

// Log configuration in development
if (__DEV__) {
  console.log('========================================');
  console.log('API Configuration (Development Mode)');
  console.log('========================================');
  console.log('API Base URL:', API_CONFIG.BASE_URL);
  console.log('WebSocket URL:', API_CONFIG.WS_URL);
  console.log('Platform:', Platform.OS);
  console.log('========================================');
}
