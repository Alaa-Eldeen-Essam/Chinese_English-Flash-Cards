import { useCallback, useEffect, useMemo, useState } from "react";

import {
  exchangeGoogleCode,
  getGoogleAuthUrl,
  getProfile,
  loginUser,
  logoutUser,
  refreshSession,
  registerUser,
  updateSettings
} from "../api/client";
import type { AuthUser } from "../types";
import { getAccessToken, getRefreshToken, setAuthTokens } from "../utils/auth";

export type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, email?: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  saveSettings: (settings: Record<string, unknown>) => Promise<void>;
  startGoogleLogin: () => Promise<void>;
  finishGoogleLogin: (code: string, state?: string | null) => Promise<void>;
};

export function useAuth(): AuthState {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const restoreSession = useCallback(async () => {
    const accessToken = getAccessToken();
    const refreshToken = getRefreshToken();
    if (!accessToken && !refreshToken) {
      setLoading(false);
      return;
    }

    try {
      if (accessToken) {
        const profile = await getProfile();
        setUser(profile);
        setLoading(false);
        return;
      }
    } catch {
      // Fall through to refresh.
    }

    if (refreshToken) {
      const refreshed = await refreshSession();
      if (refreshed) {
        setAuthTokens(refreshed.token.access_token, refreshed.token.refresh_token);
        setUser(refreshed.user);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  const login = useCallback(async (username: string, password: string) => {
    setError(null);
    try {
      const response = await loginUser({ username, password });
      setAuthTokens(response.token.access_token, response.token.refresh_token);
      setUser(response.user);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed";
      setError(message);
      throw error;
    }
  }, []);

  const register = useCallback(async (username: string, password: string, email?: string) => {
    setError(null);
    try {
      const response = await registerUser({ username, password, email });
      setAuthTokens(response.token.access_token, response.token.refresh_token);
      setUser(response.user);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Registration failed";
      setError(message);
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    await logoutUser();
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    const refreshed = await refreshSession();
    if (refreshed) {
      setAuthTokens(refreshed.token.access_token, refreshed.token.refresh_token);
      setUser(refreshed.user);
    }
  }, []);

  const saveSettings = useCallback(async (settings: Record<string, unknown>) => {
    const updated = await updateSettings(settings);
    setUser(updated);
  }, []);

  const startGoogleLogin = useCallback(async () => {
    const state =
      (globalThis.crypto?.randomUUID?.() as string | undefined) ??
      `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    sessionStorage.setItem("google_oauth_state", state);
    const response = await getGoogleAuthUrl(state);
    window.location.assign(response.auth_url);
  }, []);

  const finishGoogleLogin = useCallback(async (code: string, state?: string | null) => {
    const stored = sessionStorage.getItem("google_oauth_state");
    if (stored && state && stored !== state) {
      throw new Error("OAuth state mismatch");
    }
    const response = await exchangeGoogleCode(code);
    setAuthTokens(response.token.access_token, response.token.refresh_token);
    setUser(response.user);
    sessionStorage.removeItem("google_oauth_state");
  }, []);

  return useMemo(
    () => ({
      user,
      loading,
      error,
      isAuthenticated: Boolean(user),
      login,
      register,
      logout,
      refresh,
      saveSettings,
      startGoogleLogin,
      finishGoogleLogin
    }),
    [
      user,
      loading,
      error,
      login,
      register,
      logout,
      refresh,
      saveSettings,
      startGoogleLogin,
      finishGoogleLogin
    ]
  );
}
