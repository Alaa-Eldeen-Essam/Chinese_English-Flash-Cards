import React, { useEffect, useMemo, useState } from "react";

import { createCard, createCollection, searchCards, searchDictionary, updateCard } from "../api/client";
import type { Card, Collection, DictWord } from "../types";
import { useAppStore } from "../store/AppStore";
import { getDownloadedDatasetIds, searchDatasetEntries } from "../utils/indexedDb";
import { normalizePinyinInput } from "../utils/pinyin";

function createLocalId(): number {
  return -Math.floor(Date.now() / 1000);
}

function buildLexemeKey(simplified: string, pinyin?: string | null): string {
  const normalized = normalizePinyinInput(pinyin ?? "");
  return `${simplified}::${normalized}`;
}

function mergeCards(online: Card[], local: Card[]): Card[] {
  const merged = new Map<number, Card>();
  online.forEach((card) => merged.set(card.id, card));
  local.forEach((card) => {
    const existing = merged.get(card.id);
    if (!existing) {
      merged.set(card.id, card);
      return;
    }
    const localTime = Date.parse(card.last_modified);
    const existingTime = Date.parse(existing.last_modified);
    if (!Number.isNaN(localTime) && localTime > existingTime) {
      merged.set(card.id, card);
    }
  });
  return Array.from(merged.values());
}

export default function Collections(): JSX.Element {
  const { userData, updateUserData, enqueueAction, isOnline } = useAppStore();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<Collection | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [dictQuery, setDictQuery] = useState("");
  const [dictMode, setDictMode] = useState<
    "all" | "simplified" | "traditional" | "pinyin" | "meanings"
  >("all");
  const [dictResults, setDictResults] = useState<DictWord[]>([]);
  const [dictStatus, setDictStatus] = useState<string | null>(null);
  const [dictLoading, setDictLoading] = useState(false);

  useEffect(() => {
    if (!selected) {
      setCards([]);
      return;
    }
    if (!isOnline) {
      setCards([]);
      return;
    }
    searchCards({ collection: selected.id })
      .then((response) => setCards(response))
      .catch(() => setCards([]));
  }, [selected, isOnline]);

  const offlineCards = useMemo(() => {
    if (!selected) {
      return [];
    }
    return userData.cards.filter((card) => card.collection_ids?.includes(selected.id));
  }, [selected, userData.cards]);

  const mergedCards = useMemo(() => {
    if (!selected) {
      return [];
    }
    return mergeCards(cards, offlineCards);
  }, [cards, offlineCards, selected]);

  useEffect(() => {
    let active = true;

    const timer = window.setTimeout(async () => {
      const trimmed = dictQuery.trim();
      if (!selected || !trimmed) {
        if (active) {
          setDictResults([]);
          setDictStatus(null);
        }
        return;
      }

      setDictLoading(true);
      setDictStatus(null);
      try {
        let onlineFailed = false;
        if (isOnline) {
          try {
            const response = await searchDictionary({
              query: trimmed,
              mode: dictMode,
              limit: 10
            });
            if (!active) {
              return;
            }
            if (response.results.length > 0) {
              setDictResults(response.results);
              return;
            }
          } catch {
            onlineFailed = true;
          }
        }

        const datasetIds = await getDownloadedDatasetIds();
        if (!active) {
          return;
        }
        if (datasetIds.length === 0) {
          setDictResults([]);
          setDictStatus(
            onlineFailed
              ? "Online search failed. Download a dataset for offline search."
              : "Download a dataset for offline search."
          );
          return;
        }
        const results = await searchDatasetEntries(trimmed, {
          mode: dictMode,
          datasetIds,
          limit: 10
        });
        if (!active) {
          return;
        }
        setDictResults(results);
        if (results.length === 0) {
          setDictStatus(
            onlineFailed
              ? "Online search failed; no matches in downloaded datasets."
              : "No matches in downloaded datasets."
          );
        }
      } catch {
        if (active) {
          setDictStatus("Dictionary search failed.");
        }
      } finally {
        if (active) {
          setDictLoading(false);
        }
      }
    }, 300);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [dictMode, dictQuery, isOnline, selected]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      return;
    }

    setStatus(null);

    if (isOnline) {
      try {
        const created = await createCollection({ name, description });
        updateUserData({
          ...userData,
          collections: [...userData.collections, created],
          last_modified: new Date().toISOString()
        });
        setName("");
        setDescription("");
        setSelected(created);
        return;
      } catch (error) {
        setStatus("Create failed, using offline draft");
      }
    }

    const now = new Date().toISOString();
    const local = {
      id: createLocalId(),
      owner_id: userData.user.id,
      name,
      description,
      last_modified: now
    };
    updateUserData({
      ...userData,
      collections: [...userData.collections, local],
      last_modified: new Date().toISOString()
    });
    await enqueueAction({
      id: `${Date.now()}-collection`,
      type: "create_collection",
      payload: local,
      created_at: new Date().toISOString()
    });
    setName("");
    setDescription("");
    setSelected(local);
  }

  async function handleAddFromDict(entry: DictWord) {
    if (!selected) {
      return;
    }
    setActionStatus(null);
    const entryKey = buildLexemeKey(entry.simplified, entry.pinyin ?? "");
    const existingCard =
      userData.cards.find((card) => card.created_from_dict_id === entry.id) ??
      userData.cards.find(
        (card) => buildLexemeKey(card.simplified, card.pinyin) === entryKey
      );
    const now = new Date().toISOString();

    if (existingCard) {
      const existingCollections = existingCard.collection_ids ?? [];
      if (existingCollections.includes(selected.id)) {
        setActionStatus("Already in this collection.");
        return;
      }
      const nextCollections = Array.from(new Set([...existingCollections, selected.id]));

      if (existingCard.id > 0 && isOnline) {
        try {
          const updated = await updateCard(existingCard.id, {
            collection_ids: nextCollections
          });
          updateUserData({
            ...userData,
            cards: userData.cards.map((card) => (card.id === updated.id ? updated : card)),
            last_modified: now
          });
          setCards((prev) => mergeCards(prev, [updated]));
          setActionStatus("Added to collection.");
          return;
        } catch {
          setActionStatus("Update failed, using offline draft");
        }
      }

      const offlineUpdated: Card = {
        ...existingCard,
        collection_ids: nextCollections,
        last_modified: now
      };
      updateUserData({
        ...userData,
        cards: userData.cards.map((card) =>
          card.id === offlineUpdated.id ? offlineUpdated : card
        ),
        last_modified: now
      });
      await enqueueAction({
        id: `${Date.now()}-card-update`,
        type: "update_card",
        payload: offlineUpdated,
        created_at: now
      });
      setActionStatus("Added to collection offline.");
      return;
    }

    const payload = {
      simplified: entry.simplified,
      pinyin: entry.pinyin ?? "",
      meanings: entry.meanings,
      examples: entry.examples,
      tags: entry.tags,
      created_from_dict_id: entry.id,
      collection_ids: [selected.id]
    };

    if (isOnline) {
      try {
        const created = await createCard(payload);
        updateUserData({
          ...userData,
          cards: [...userData.cards, created],
          last_modified: new Date().toISOString()
        });
        setCards((prev) => mergeCards(prev, [created]));
        return;
      } catch (error) {
        setActionStatus("Create failed, using offline draft");
      }
    }

    const localCard: Card = {
      id: createLocalId(),
      owner_id: userData.user.id,
      simplified: payload.simplified,
      pinyin: payload.pinyin ?? "",
      meanings: payload.meanings ?? [],
      examples: payload.examples ?? [],
      tags: payload.tags ?? [],
      created_from_dict_id: entry.id,
      easiness: 2.5,
      interval_days: 0,
      repetitions: 0,
      next_due: now,
      collection_ids: [selected.id],
      last_modified: now
    };
    updateUserData({
      ...userData,
      cards: [...userData.cards, localCard],
      last_modified: new Date().toISOString()
    });
    await enqueueAction({
      id: `${Date.now()}-card`,
      type: "create_card",
      payload: localCard,
      created_at: new Date().toISOString()
    });
    setActionStatus("Card added offline.");
  }

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h1>Collections</h1>
          <p>Organize cards into focused study groups.</p>
        </div>
      </header>

      <div className="panel-grid">
        <div className="panel">
          <h2>New collection</h2>
          <form className="form" onSubmit={handleCreate}>
            <label>
              Name
              <input value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label>
              Description
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
            <button className="primary" type="submit">
              Save collection
            </button>
            {status && <p className="muted">{status}</p>}
          </form>
        </div>
        <div className="panel">
          <h2>Your collections</h2>
          {userData.collections.length === 0 ? (
            <p className="muted">No collections yet. Create your first deck.</p>
          ) : (
            <ul className="list selectable">
              {userData.collections.map((collection) => (
                <li
                  key={collection.id}
                  className={selected?.id === collection.id ? "active" : ""}
                  onClick={() => setSelected(collection)}
                >
                  <span>{collection.name}</span>
                  <span className="muted">{collection.description || "No description"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="panel">
        <h2>Cards in collection</h2>
        {!selected && <p className="muted">Select a collection to view cards.</p>}
        {selected && (
          <div className="form">
            <label>
              Add from dictionary
              <div className="inline-meta">
                <input
                  placeholder="Search dictionary"
                  value={dictQuery}
                  onChange={(event) => setDictQuery(event.target.value)}
                />
                <select
                  value={dictMode}
                  onChange={(event) =>
                    setDictMode(
                      event.target.value as
                        | "all"
                        | "simplified"
                        | "traditional"
                        | "pinyin"
                        | "meanings"
                    )
                  }
                >
                  <option value="all">All</option>
                  <option value="simplified">Simplified</option>
                  <option value="traditional">Traditional</option>
                  <option value="pinyin">Pinyin</option>
                  <option value="meanings">Meanings</option>
                </select>
              </div>
            </label>
            {dictLoading && <p className="muted">Searching dictionary...</p>}
            {dictResults.length > 0 && (
              <ul className="list selectable">
                {dictResults.map((entry) => (
                  <li key={entry.id}>
                    <span>{entry.simplified}</span>
                    <span className="muted">{entry.pinyin}</span>
                    <button
                      className="secondary"
                      type="button"
                      onClick={() => handleAddFromDict(entry)}
                    >
                      Add
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {!dictLoading && dictStatus && <p className="muted">{dictStatus}</p>}
            {actionStatus && <p className="muted">{actionStatus}</p>}
          </div>
        )}

        {selected && !isOnline && offlineCards.length === 0 && (
          <p className="muted">No offline cards in this collection yet.</p>
        )}
        {selected && isOnline && mergedCards.length === 0 && (
          <p className="muted">No cards in this collection yet.</p>
        )}
        {selected && !isOnline && offlineCards.length > 0 && (
          <ul className="list">
            {offlineCards.map((card) => (
              <li key={card.id}>
                <span>{card.simplified}</span>
                <span className="muted">{card.pinyin}</span>
              </li>
            ))}
          </ul>
        )}
        {selected && isOnline && mergedCards.length > 0 && (
          <ul className="list">
            {mergedCards.map((card) => (
              <li key={card.id}>
                <span>{card.simplified}</span>
                <span className="muted">{card.pinyin}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
