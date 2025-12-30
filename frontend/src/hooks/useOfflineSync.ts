import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchUserDump, syncUserData } from "../api/client";
import type { SyncQueueItem, UserData } from "../types";
import { createEmptyUserData } from "../utils/data";
import { clearQueue, enqueue, getQueue, getUserData, setUserData } from "../utils/indexedDb";

export type OfflineSyncState = {
  userData: UserData;
  queue: SyncQueueItem[];
  isOnline: boolean;
  loading: boolean;
  lastSyncAt: string | null;
  refreshFromServer: () => Promise<void>;
  updateUserData: (next: UserData) => void;
  enqueueAction: (item: SyncQueueItem) => Promise<void>;
  flushQueue: () => Promise<void>;
};

export function useOfflineSync(): OfflineSyncState {
  const [userData, setUserDataState] = useState<UserData>(createEmptyUserData());
  const [queue, setQueueState] = useState<SyncQueueItem[]>([]);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [loading, setLoading] = useState(true);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  const updateUserData = useCallback((next: UserData) => {
    setUserDataState(next);
    void setUserData(next);
  }, []);

  const hydrateFromStorage = useCallback(async () => {
    const [storedUser, storedQueue] = await Promise.all([getUserData(), getQueue()]);
    if (storedUser) {
      setUserDataState(storedUser);
    }
    setQueueState(storedQueue);
  }, []);

  const refreshFromServer = useCallback(async () => {
    if (!isOnline) {
      return;
    }
    try {
      const fresh = await fetchUserDump();
      updateUserData(fresh);
      setLastSyncAt(new Date().toISOString());
    } catch {
      // Keep local data when refresh fails.
    }
  }, [isOnline, updateUserData]);

  const enqueueAction = useCallback(async (item: SyncQueueItem) => {
    await enqueue(item);
    setQueueState((prev) => [...prev, item]);
  }, []);

  const flushQueue = useCallback(async () => {
    if (!isOnline || queue.length === 0) {
      return;
    }
    try {
      await syncUserData({
        user_id: "me",
        cards: [],
        collections: [],
        study_logs: queue,
        last_modified: userData.last_modified
      });
      await clearQueue(queue.map((item) => item.id));
      setQueueState([]);
      setLastSyncAt(new Date().toISOString());
    } catch {
      // Leave queue intact for next attempt.
    }
  }, [isOnline, queue, userData.last_modified]);

  useEffect(() => {
    hydrateFromStorage()
      .catch(() => {
        setUserDataState(createEmptyUserData());
      })
      .finally(() => {
        setLoading(false);
      });
  }, [hydrateFromStorage]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (isOnline) {
      void refreshFromServer();
    }
  }, [isOnline, refreshFromServer]);

  useEffect(() => {
    if (isOnline && queue.length > 0) {
      void flushQueue();
    }
  }, [isOnline, queue.length, flushQueue]);

  return useMemo(
    () => ({
      userData,
      queue,
      isOnline,
      loading,
      lastSyncAt,
      refreshFromServer,
      updateUserData,
      enqueueAction,
      flushQueue
    }),
    [
      userData,
      queue,
      isOnline,
      loading,
      lastSyncAt,
      refreshFromServer,
      updateUserData,
      enqueueAction,
      flushQueue
    ]
  );
}
