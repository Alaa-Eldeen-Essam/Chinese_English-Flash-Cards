import React, { useEffect, useMemo, useState } from "react";

import StudyCard from "../components/StudyCard";
import { getSchedule } from "../api/client";
import type { Card, StudyMode } from "../types";
import { useAppStore } from "../store/AppStore";
import { useSRS } from "../hooks/useSRS";
import { useAuthStore } from "../store/AuthStore";
import {
  getLastStudyCollectionSelection,
  setLastStudyCollectionSelection,
  type StudyCollectionSelection
} from "../utils/indexedDb";

function isDue(card: Card): boolean {
  return new Date(card.next_due).getTime() <= Date.now();
}

export default function Study(): JSX.Element {
  const { userData, isOnline } = useAppStore();
  const { recordReview } = useSRS();
  const { user, saveSettings } = useAuthStore();
  const [queue, setQueue] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState(Date.now());
  const [mode, setMode] = useState<StudyMode>("standard");
  const [collectionId, setCollectionId] = useState<number | "all">("all");
  const [localSelection, setLocalSelection] = useState<StudyCollectionSelection | null>(null);
  const [localSelectionLoaded, setLocalSelectionLoaded] = useState(false);
  const selectionUserId = user?.id ?? userData.user.id;

  useEffect(() => {
    let active = true;
    setLocalSelectionLoaded(false);
    void getLastStudyCollectionSelection(selectionUserId)
      .then((value) => {
        if (!active) {
          return;
        }
        setLocalSelection(value);
        setLocalSelectionLoaded(true);
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setLocalSelection(null);
        setLocalSelectionLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [selectionUserId]);

  const mostRecentCollectionId = useMemo(() => {
    const cardsById = new Map(userData.cards.map((card) => [card.id, card]));
    const sortedLogs = [...userData.study_logs].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    for (const log of sortedLogs) {
      const card = cardsById.get(log.card_id);
      if (card?.collection_ids && card.collection_ids.length > 0) {
        return card.collection_ids[0];
      }
    }
    return null;
  }, [userData.cards, userData.study_logs]);

  const settingsSelection = useMemo(() => {
    const settings = (user?.settings ?? {}) as Record<string, unknown>;
    const combined = settings["study_collection"];
    if (typeof combined === "object" && combined !== null) {
      const value = (combined as { value?: unknown }).value;
      const updated_at = (combined as { updated_at?: unknown }).updated_at;
      if (value === "all" || typeof value === "number") {
        return {
          value,
          updated_at: typeof updated_at === "string" ? updated_at : null
        } satisfies StudyCollectionSelection;
      }
    }

    const storedUpdatedAt =
      typeof settings["study_collection_updated_at"] === "string"
        ? (settings["study_collection_updated_at"] as string)
        : null;
    const storedId = settings["study_collection_id"];
    if (typeof storedId === "number") {
      return { value: storedId, updated_at: storedUpdatedAt };
    }
    if (storedUpdatedAt) {
      return { value: "all", updated_at: storedUpdatedAt };
    }
    return null;
  }, [user]);

  const selectedCollectionCardCount = useMemo(() => {
    if (collectionId === "all") {
      return userData.cards.length;
    }
    return userData.cards.filter((card) => card.collection_ids?.includes(collectionId)).length;
  }, [collectionId, userData.cards]);

  useEffect(() => {
    const settings = user?.settings ?? {};
    const preferred = settings["study_mode"];
    if (preferred === "typing" || preferred === "listening" || preferred === "cloze") {
      setMode(preferred);
    } else {
      setMode("standard");
    }
  }, [user]);

  useEffect(() => {
    if (!localSelectionLoaded) {
      return;
    }

    const toTimestamp = (value: string | null | undefined): number | null => {
      if (!value) {
        return null;
      }
      const parsed = Date.parse(value);
      return Number.isNaN(parsed) ? null : parsed;
    };

    const local = localSelection;
    const localTs = toTimestamp(local?.updated_at ?? null);
    const settingsTs = toTimestamp(settingsSelection?.updated_at ?? null);

    let resolved: StudyCollectionSelection | null = null;
    let source: "local" | "remote" | "fallback" = "fallback";

    if (local && settingsSelection) {
      if (localTs !== null && settingsTs !== null) {
        if (localTs >= settingsTs) {
          resolved = local;
          source = "local";
        } else {
          resolved = settingsSelection;
          source = "remote";
        }
      } else if (localTs !== null && settingsTs === null) {
        resolved = local;
        source = "local";
      } else if (localTs === null && settingsTs !== null) {
        resolved = settingsSelection;
        source = "remote";
      } else {
        resolved = local;
        source = "local";
      }
    } else if (local) {
      resolved = local;
      source = "local";
    } else if (settingsSelection) {
      resolved = settingsSelection;
      source = "remote";
    } else if (typeof mostRecentCollectionId === "number") {
      resolved = { value: mostRecentCollectionId, updated_at: null };
      source = "fallback";
    } else {
      resolved = { value: "all", updated_at: null };
      source = "fallback";
    }

    if (resolved) {
      setCollectionId(resolved.value);
    }

    let syncedLocal = local;
    if (source === "local" && local && !local.updated_at) {
      const updated = { ...local, updated_at: new Date().toISOString() };
      syncedLocal = updated;
      setLocalSelection(updated);
      void setLastStudyCollectionSelection(updated, selectionUserId);
    }

    if (source === "remote" && settingsSelection) {
      if (
        !syncedLocal ||
        syncedLocal.value !== settingsSelection.value ||
        syncedLocal.updated_at !== settingsSelection.updated_at
      ) {
        setLocalSelection(settingsSelection);
        void setLastStudyCollectionSelection(settingsSelection, selectionUserId);
      }
    }

    if (source === "local" && syncedLocal && isOnline && user) {
      const needsSync =
        !settingsSelection ||
        syncedLocal.value !== settingsSelection.value ||
        syncedLocal.updated_at !== settingsSelection.updated_at;
      if (needsSync) {
        const nextSettings = { ...(user.settings ?? {}) } as Record<string, unknown>;
        nextSettings["study_collection"] = {
          value: syncedLocal.value,
          updated_at: syncedLocal.updated_at
        };
        if (syncedLocal.value === "all") {
          delete nextSettings["study_collection_id"];
        } else {
          nextSettings["study_collection_id"] = syncedLocal.value;
        }
        nextSettings["study_collection_updated_at"] = syncedLocal.updated_at;
        void saveSettings(nextSettings);
      }
    }
  }, [
    isOnline,
    localSelection,
    localSelectionLoaded,
    mostRecentCollectionId,
    saveSettings,
    selectionUserId,
    settingsSelection,
    user
  ]);

  const fallbackQueue = useMemo(() => {
    let cards = [...userData.cards].filter(isDue);
    if (collectionId !== "all") {
      cards = cards.filter((card) => card.collection_ids?.includes(collectionId));
    }
    return cards
      .sort((a, b) => a.next_due.localeCompare(b.next_due))
      .slice(0, 20);
  }, [collectionId, userData.cards]);

  useEffect(() => {
    let mounted = true;
    async function loadSchedule() {
      setLoading(true);
      setError(null);
      if (isOnline) {
        try {
          const response = await getSchedule({
            n: 20,
            collection_id: collectionId === "all" ? undefined : collectionId
          });
          if (mounted) {
            setQueue(response.cards);
          }
        } catch (err) {
          if (mounted) {
            setQueue(fallbackQueue);
            setError("Using offline schedule");
          }
        } finally {
          if (mounted) {
            setLoading(false);
          }
        }
      } else {
        setQueue(fallbackQueue);
        setLoading(false);
      }
    }

    void loadSchedule();

    return () => {
      mounted = false;
    };
  }, [collectionId, isOnline, fallbackQueue]);

  useEffect(() => {
    setStartedAt(Date.now());
  }, [queue[0]?.id]);

  const currentCard = queue[0];

  async function handleRate(quality: number) {
    if (!currentCard) {
      return;
    }
    const responseTimeMs = Date.now() - startedAt;
    await recordReview(currentCard, quality, responseTimeMs);
    setQueue((prev) => prev.slice(1));
  }

  async function handleCollectionChange(next: string) {
    const now = new Date().toISOString();
    if (next === "all") {
      setCollectionId("all");
      const selection: StudyCollectionSelection = { value: "all", updated_at: now };
      setLocalSelection(selection);
      void setLastStudyCollectionSelection(selection, selectionUserId);
      if (user && isOnline) {
        const settings = { ...(user.settings ?? {}) };
        settings["study_collection"] = {
          value: "all",
          updated_at: now
        };
        delete settings["study_collection_id"];
        settings["study_collection_updated_at"] = now;
        try {
          await saveSettings(settings);
        } catch {
          // Ignore settings errors when offline or unreachable.
        }
      }
      return;
    }

    const parsed = Number(next);
    if (Number.isNaN(parsed)) {
      return;
    }
    setCollectionId(parsed);
    const selection: StudyCollectionSelection = { value: parsed, updated_at: now };
    setLocalSelection(selection);
    void setLastStudyCollectionSelection(selection, selectionUserId);
    if (user && isOnline) {
      try {
        await saveSettings({
          ...(user.settings ?? {}),
          study_collection: {
            value: parsed,
            updated_at: now
          },
          study_collection_id: parsed,
          study_collection_updated_at: now
        });
      } catch {
        // Ignore settings errors when offline or unreachable.
      }
    }
  }

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h1>Study Session</h1>
          <p>Answer quickly, then rate the recall quality.</p>
        </div>
        <div className="inline-meta">
          <span>Queue: {queue.length}</span>
          <span>Mode: {isOnline ? "Online" : "Offline"}</span>
          <label className="study-mode">
            Collection
            <select
              value={collectionId === "all" ? "all" : String(collectionId)}
              onChange={(event) => void handleCollectionChange(event.target.value)}
            >
              <option value="all">All collections</option>
              {userData.collections.map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.name}
                </option>
              ))}
            </select>
          </label>
          {collectionId !== "all" && selectedCollectionCardCount === 0 && (
            <span className="status-pill">Empty</span>
          )}
          <label className="study-mode">
            Study mode
            <select value={mode} onChange={(event) => setMode(event.target.value as StudyMode)}>
              <option value="standard">Standard</option>
              <option value="typing">Typing</option>
              <option value="listening">Listening</option>
              <option value="cloze">Cloze</option>
            </select>
          </label>
        </div>
      </header>

      {loading ? (
        <div className="panel">Loading schedule...</div>
      ) : currentCard ? (
        <div className="panel">
          {error && <p className="muted">{error}</p>}
          <StudyCard card={currentCard} onRate={handleRate} mode={mode} />
        </div>
      ) : (
        <div className="panel empty">
          <h2>All done</h2>
          {collectionId !== "all" && selectedCollectionCardCount === 0 ? (
            <p>This collection has no cards yet.</p>
          ) : collectionId !== "all" ? (
            <p>No due cards in this collection.</p>
          ) : (
            <p>No cards due right now. Come back later or import more vocab.</p>
          )}
        </div>
      )}
    </section>
  );
}
