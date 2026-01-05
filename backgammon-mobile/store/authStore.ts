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
