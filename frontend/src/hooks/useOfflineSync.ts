import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchUserDump, syncUserData } from "../api/client";
import type { Card, Collection, StudyLog, SyncQueueItem, UserData } from "../types";
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
      const cardMap = new Map<number, Card>();
      const collectionMap = new Map<number, Collection>();

      queue
        .filter((item) => item.type === "create_card" || item.type === "update_card")
        .forEach((item) => {
          const card = item.payload as Card;
          cardMap.set(card.id, card);
        });

      queue
        .filter(
          (item) => item.type === "create_collection" || item.type === "update_collection"
        )
        .forEach((item) => {
          const collection = item.payload as Collection;
          collectionMap.set(collection.id, collection);
        });

      const cards = Array.from(cardMap.values());
      const collections = Array.from(collectionMap.values());
      const studyLogs = queue
        .filter((item) => item.type === "study")
        .map((item) => item.payload as StudyLog);

      const response = await syncUserData({
        cards,
        collections,
        study_logs: studyLogs,
        last_modified: userData.last_modified
      });

      const cardIdMap = response.id_map?.cards ?? {};
      const collectionIdMap = response.id_map?.collections ?? {};
      if (Object.keys(cardIdMap).length > 0 || Object.keys(collectionIdMap).length > 0) {
        const remapCollectionId = (id: number) =>
          collectionIdMap[String(id)] ?? id;
        const remapCardId = (id: number) =>
          cardIdMap[String(id)] ?? id;

        const updatedCollections = userData.collections.map((collection) => ({
          ...collection,
          id: remapCollectionId(collection.id)
        }));

        const updatedCards = userData.cards.map((card) => ({
          ...card,
          id: remapCardId(card.id),
          collection_ids: (card.collection_ids ?? []).map(remapCollectionId)
        }));

        const updatedLogs = userData.study_logs.map((log) => ({
          ...log,
          card_id: remapCardId(log.card_id)
        }));

        updateUserData({
          ...userData,
          collections: updatedCollections,
          cards: updatedCards,
          study_logs: updatedLogs,
          last_modified: new Date().toISOString()
        });
      }

      await clearQueue(queue.map((item) => item.id));
      setQueueState([]);
      setLastSyncAt(new Date().toISOString());
    } catch {
      // Leave queue intact for next attempt.
    }
  }, [isOnline, queue, updateUserData, userData]);

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
