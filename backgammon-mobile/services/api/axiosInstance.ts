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
