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
