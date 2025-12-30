import React, { createContext, useContext } from "react";

import type { AuthState } from "../hooks/useAuth";
import { useAuth } from "../hooks/useAuth";

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const auth = useAuth();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuthStore(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuthStore must be used within AuthProvider");
  }
  return ctx;
}
