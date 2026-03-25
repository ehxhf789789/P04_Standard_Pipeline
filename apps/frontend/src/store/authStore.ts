/**
 * Authentication Store (Zustand)
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { authApi, User, LoginCredentials, RegisterData } from "@/lib/api/auth";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (credentials: LoginCredentials) => {
        set({ isLoading: true, error: null });

        try {
          await authApi.login(credentials);
          const user = await authApi.getMe();
          set({ user, isAuthenticated: true, isLoading: false });
        } catch (e: any) {
          const message = e.response?.data?.detail || "Login failed";
          set({ error: message, isLoading: false });
          throw e;
        }
      },

      register: async (data: RegisterData) => {
        set({ isLoading: true, error: null });

        try {
          await authApi.register(data);
          // After registration, log in automatically
          await get().login({ email: data.email, password: data.password });
        } catch (e: any) {
          const message = e.response?.data?.detail || "Registration failed";
          set({ error: message, isLoading: false });
          throw e;
        }
      },

      logout: async () => {
        set({ isLoading: true });

        try {
          await authApi.logout();
        } finally {
          set({ user: null, isAuthenticated: false, isLoading: false });
        }
      },

      checkAuth: async () => {
        if (!authApi.isAuthenticated()) {
          set({ user: null, isAuthenticated: false });
          return;
        }

        set({ isLoading: true });

        try {
          const user = await authApi.getMe();
          set({ user, isAuthenticated: true, isLoading: false });
        } catch (e) {
          // Token might be expired, try to refresh
          try {
            await authApi.refreshToken();
            const user = await authApi.getMe();
            set({ user, isAuthenticated: true, isLoading: false });
          } catch {
            // Refresh failed, clear auth
            await authApi.logout();
            set({ user: null, isAuthenticated: false, isLoading: false });
          }
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      skipHydration: true,
    }
  )
);

export default useAuthStore;
