/**
 * Authentication API
 */

import apiClient from "./client";

export interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

const TOKEN_KEY = "token";
const REFRESH_TOKEN_KEY = "refresh_token";

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<TokenResponse> => {
    const { data } = await apiClient.post("/auth/login/json", credentials);

    // Store tokens
    if (typeof window !== "undefined") {
      localStorage.setItem(TOKEN_KEY, data.access_token);
      localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
    }

    return data;
  },

  register: async (userData: RegisterData): Promise<User> => {
    const { data } = await apiClient.post("/auth/register", userData);
    return data;
  },

  logout: async (): Promise<void> => {
    try {
      await apiClient.post("/auth/logout");
    } catch (e) {
      // Ignore errors, just clear local tokens
    } finally {
      if (typeof window !== "undefined") {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
      }
    }
  },

  getMe: async (): Promise<User> => {
    const { data } = await apiClient.get("/auth/me");
    return data;
  },

  refreshToken: async (): Promise<TokenResponse> => {
    const refreshToken = typeof window !== "undefined"
      ? localStorage.getItem(REFRESH_TOKEN_KEY)
      : null;

    if (!refreshToken) {
      throw new Error("No refresh token available");
    }

    const { data } = await apiClient.post("/auth/refresh", {
      refresh_token: refreshToken,
    });

    // Store new tokens
    if (typeof window !== "undefined") {
      localStorage.setItem(TOKEN_KEY, data.access_token);
      localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
    }

    return data;
  },

  getToken: (): string | null => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(TOKEN_KEY);
  },

  isAuthenticated: (): boolean => {
    return !!authApi.getToken();
  },
};

export default authApi;
