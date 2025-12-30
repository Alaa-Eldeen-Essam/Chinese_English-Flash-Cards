import React, { createContext, useContext } from "react";

import type { OfflineSyncState } from "../hooks/useOfflineSync";
import { useOfflineSync } from "../hooks/useOfflineSync";

const AppStoreContext = createContext<OfflineSyncState | null>(null);

export function AppStoreProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const syncState = useOfflineSync();
  return <AppStoreContext.Provider value={syncState}>{children}</AppStoreContext.Provider>;
}

export function useAppStore(): OfflineSyncState {
  const ctx = useContext(AppStoreContext);
  if (!ctx) {
    throw new Error("useAppStore must be used within AppStoreProvider");
  }
  return ctx;
}
