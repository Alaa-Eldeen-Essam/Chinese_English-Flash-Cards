import React, { useEffect, useMemo, useState } from "react";

import { createCard, searchDictionary, updateCard } from "../api/client";
import type { Card, DictWord } from "../types";
import { useAppStore } from "../store/AppStore";
import { getDownloadedDatasetIds, searchDatasetEntries } from "../utils/indexedDb";
import { normalizePinyinForKey } from "../utils/pinyin";

function createLocalCardId(): number {
  return -Math.floor(Date.now() / 1000);
}

function buildLexemeKey(simplified: string, pinyin?: string | null): string {
  const normalized = normalizePinyinForKey(pinyin ?? "");
  return `${simplified}::${normalized}`;
}

export default function CardEditor(): JSX.Element {
  const { userData, updateUserData, enqueueAction, isOnline } = useAppStore();
  const [simplified, setSimplified] = useState("");
  const [pinyin, setPinyin] = useState("");
  const [meanings, setMeanings] = useState("");
  const [tags, setTags] = useState("");
  const [query, setQuery] = useState("");
  const [dictMode, setDictMode] = useState<
    "all" | "simplified" | "traditional" | "pinyin" | "meanings"
  >("all");
  const [dictResults, setDictResults] = useState<DictWord[]>([]);
  const [dictStatus, setDictStatus] = useState<string | null>(null);
  const [dictLoading, setDictLoading] = useState(false);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [selectedCollections, setSelectedCollections] = useState<number[]>([]);
  const [sourceDictId, setSourceDictId] = useState<number | null>(null);
  const [downloadedDatasets, setDownloadedDatasets] = useState<string[]>([]);
  const [editingCardId, setEditingCardId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    void getDownloadedDatasetIds()
      .then((ids) => {
        if (active) {
          setDownloadedDatasets(ids);
        }
      })
      .catch(() => {
        // Ignore dataset meta errors.
      });
    return () => {
      active = false;
    };
  }, []);

  const suggestions = useMemo(() => {
    if (!query.trim()) {
      return [];
    }
    return userData.cards
      .filter((card) =>
        card.simplified.toLowerCase().includes(query.toLowerCase()) ||
        card.pinyin.toLowerCase().includes(query.toLowerCase())
      )
      .slice(0, 5);
  }, [query, userData.cards]);

  const cardByDictId = useMemo(() => {
    const map = new Map<number, Card>();
    userData.cards.forEach((card) => {
      if (card.created_from_dict_id) {
        map.set(card.created_from_dict_id, card);
      }
    });
    return map;
  }, [userData.cards]);

  const cardByLexeme = useMemo(() => {
    const map = new Map<string, Card>();
    userData.cards.forEach((card) => {
      map.set(buildLexemeKey(card.simplified, card.pinyin), card);
    });
    return map;
  }, [userData.cards]);

  function applySuggestion(card: Card) {
    setSimplified(card.simplified);
    setPinyin(card.pinyin);
    setMeanings(card.meanings.join("; "));
    setTags(card.tags.join(", "));
    setSourceDictId(card.created_from_dict_id ?? null);
    setSelectedCollections(card.collection_ids ?? []);
    setEditingCardId(card.id);
  }

  function applyDictEntry(entry: DictWord) {
    setSimplified(entry.simplified);
    setPinyin(entry.pinyin ?? "");
    setMeanings(entry.meanings.join("; "));
    setTags(entry.tags.join(", "));
    setSourceDictId(entry.id);
    setEditingCardId(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!simplified.trim()) {
      return;
    }

    const payload = {
      simplified,
      pinyin,
      meanings: meanings.split(";").map((item) => item.trim()).filter(Boolean),
      tags: tags.split(",").map((item) => item.trim()).filter(Boolean),
      examples: [] as string[],
      created_from_dict_id: sourceDictId,
      collection_ids: selectedCollections
    };

    setStatus(null);

    if (editingCardId) {
      const existing = userData.cards.find((card) => card.id === editingCardId);
      if (!existing) {
        setEditingCardId(null);
      } else {
        const now = new Date().toISOString();
        if (isOnline && existing.id > 0) {
          try {
            const updated = await updateCard(existing.id, {
              simplified: payload.simplified,
              pinyin: payload.pinyin,
              meanings: payload.meanings,
              tags: payload.tags,
              collection_ids: payload.collection_ids
            });
            updateUserData({
              ...userData,
              cards: userData.cards.map((card) => (card.id === updated.id ? updated : card)),
              last_modified: now
            });
            setStatus("Card updated.");
            setEditingCardId(null);
            return;
          } catch {
            setStatus("Update failed, using offline draft");
          }
        }

        const offlineUpdated: Card = {
          ...existing,
          simplified: payload.simplified,
          pinyin: payload.pinyin,
          meanings: payload.meanings,
          tags: payload.tags,
          collection_ids: payload.collection_ids,
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
        setStatus("Card updated offline.");
        setEditingCardId(null);
        return;
      }
    }

    if (isOnline) {
      try {
        const created = await createCard(payload);
        updateUserData({
          ...userData,
          cards: [...userData.cards, created],
          last_modified: new Date().toISOString()
        });
        setSimplified("");
        setPinyin("");
        setMeanings("");
        setTags("");
        setSourceDictId(null);
        setSelectedCollections([]);
        return;
      } catch (error) {
        setStatus("Create failed, using offline draft");
      }
    }

    const now = new Date().toISOString();
    const localCard: Card = {
      id: createLocalCardId(),
      owner_id: userData.user.id,
      simplified,
      pinyin,
      meanings: payload.meanings,
      examples: [],
      tags: payload.tags,
      created_from_dict_id: sourceDictId,
      easiness: 2.5,
      interval_days: 0,
      repetitions: 0,
      next_due: now,
      collection_ids: selectedCollections,
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

    setSimplified("");
    setPinyin("");
    setMeanings("");
    setTags("");
    setSourceDictId(null);
    setSelectedCollections([]);
    setEditingCardId(null);
  }

  function toggleCollection(collectionId: number) {
    setSelectedCollections((prev) =>
      prev.includes(collectionId)
        ? prev.filter((id) => id !== collectionId)
        : [...prev, collectionId]
    );
  }

  async function handleAddFromDict(entry: DictWord, existingCard?: Card) {
    setActionStatus(null);
    const now = new Date().toISOString();
    if (existingCard) {
      const nextCollectionIds = Array.from(
        new Set([...(existingCard.collection_ids ?? []), ...selectedCollections])
      );
      const sameCollections =
        nextCollectionIds.length === (existingCard.collection_ids ?? []).length;
      if (sameCollections) {
        setActionStatus("Already in selected collection(s).");
        return;
      }

      if (isOnline) {
        try {
          const updated = await updateCard(existingCard.id, {
            collection_ids: nextCollectionIds
          });
          updateUserData({
            ...userData,
            cards: userData.cards.map((card) => (card.id === updated.id ? updated : card)),
            last_modified: now
          });
          setActionStatus("Collections updated.");
          return;
        } catch {
          setActionStatus("Update failed, queued offline.");
        }
      }

      const offlineUpdated: Card = {
        ...existingCard,
        collection_ids: nextCollectionIds,
        last_modified: now
      };
      updateUserData({
        ...userData,
        cards: userData.cards.map((card) => (card.id === offlineUpdated.id ? offlineUpdated : card)),
        last_modified: now
      });
      await enqueueAction({
        id: `${Date.now()}-card-update`,
        type: "update_card",
        payload: offlineUpdated,
        created_at: now
      });
      setActionStatus("Collections updated offline.");
      return;
    }

    const payload = {
      simplified: entry.simplified,
      pinyin: entry.pinyin ?? "",
      meanings: entry.meanings,
      examples: entry.examples,
      tags: entry.tags,
      created_from_dict_id: entry.id,
      collection_ids: selectedCollections
    };

    if (isOnline) {
      try {
        const created = await createCard(payload);
        updateUserData({
          ...userData,
          cards: [...userData.cards, created],
          last_modified: new Date().toISOString()
        });
        setActionStatus("Card added.");
        return;
      } catch {
        setActionStatus("Create failed, queued offline.");
      }
    }

    const localCard: Card = {
      id: createLocalCardId(),
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
      collection_ids: selectedCollections,
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
  }

  useEffect(() => {
    let active = true;

    const timer = window.setTimeout(async () => {
      const trimmed = query.trim();
      if (!trimmed) {
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
              limit: 12
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
        setDownloadedDatasets(datasetIds);
        if (datasetIds.length === 0) {
          setDictResults([]);
          setDictStatus(
            onlineFailed
              ? "Online search failed. Download a dataset for offline search."
              : "Download a dataset for offline dictionary search."
          );
          return;
        }
        const results = await searchDatasetEntries(trimmed, {
          mode: dictMode,
          datasetIds,
          limit: 12
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
  }, [dictMode, isOnline, query]);

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h1>Card Editor</h1>
          <p>Create new flashcards and reuse dictionary suggestions.</p>
        </div>
      </header>

      <div className="panel-grid">
        <div className="panel">
          <h2>Create a card</h2>
          <form className="form" onSubmit={handleSubmit}>
            <label>
              Simplified
              <input value={simplified} onChange={(event) => setSimplified(event.target.value)} />
            </label>
            <label>
              Pinyin
              <input value={pinyin} onChange={(event) => setPinyin(event.target.value)} />
            </label>
            <label>
              Meanings (semicolon-separated)
              <textarea value={meanings} onChange={(event) => setMeanings(event.target.value)} />
            </label>
            <label>
              Tags (comma-separated)
              <input value={tags} onChange={(event) => setTags(event.target.value)} />
            </label>
            <div>
              <span className="muted">Collections</span>
              {userData.collections.length === 0 ? (
                <p className="muted">Create a collection to organize new cards.</p>
              ) : (
                <ul className="list selectable">
                  {userData.collections.map((collection) => (
                    <li key={collection.id}>
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          checked={selectedCollections.includes(collection.id)}
                          onChange={() => toggleCollection(collection.id)}
                        />
                        <div>
                          <div>{collection.name}</div>
                          <div className="muted">
                            {collection.description || "No description"}
                          </div>
                        </div>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button className="primary" type="submit">
              {editingCardId ? "Update card" : "Save card"}
            </button>
            {editingCardId && (
              <button
                className="secondary"
                type="button"
                onClick={() => {
                  setEditingCardId(null);
                  setSimplified("");
                  setPinyin("");
                  setMeanings("");
                  setTags("");
                  setSelectedCollections([]);
                  setSourceDictId(null);
                }}
              >
                Cancel edit
              </button>
            )}
            {status && <p className="muted">{status}</p>}
          </form>
        </div>

        <div className="panel">
          <h2>Dictionary lookup</h2>
          <p className="muted">
            Search the dictionary to populate new cards or add them directly to collections.
          </p>
          <div className="inline-meta">
            <input
              placeholder="Search simplified, pinyin, or meaning"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
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

          {suggestions.length > 0 && (
            <>
              <h3>Your cards</h3>
              <ul className="list selectable">
                {suggestions.map((card) => (
                  <li key={card.id} onClick={() => applySuggestion(card)}>
                    <span>{card.simplified}</span>
                    <span className="muted">{card.pinyin}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {dictLoading && <p className="muted">Searching dictionary...</p>}
          {dictResults.length > 0 ? (
            <ul className="list selectable">
              {dictResults.map((entry) => {
                const existingCard =
                  cardByDictId.get(entry.id) ??
                  cardByLexeme.get(buildLexemeKey(entry.simplified, entry.pinyin ?? ""));
                const existingCollections = existingCard?.collection_ids ?? [];
                const missingCollections = selectedCollections.filter(
                  (id) => !existingCollections.includes(id)
                );
                const canAddToCollections =
                  !existingCard || missingCollections.length > 0;
                const actionLabel = existingCard
                  ? canAddToCollections
                    ? "Add to collections"
                    : "Already added"
                  : "Add to collections";
                return (
                  <li key={entry.id}>
                    <div className="inline-meta">
                      <span>{entry.simplified}</span>
                      <span className="muted">{entry.pinyin}</span>
                      {entry.hsk_level && <span className="muted">HSK {entry.hsk_level}</span>}
                    </div>
                    <div className="muted">{entry.meanings.join("; ")}</div>
                    <div className="inline-meta">
                      <button
                        className="secondary"
                        type="button"
                        onClick={() => applyDictEntry(entry)}
                      >
                        Use in form
                      </button>
                      <button
                        className="primary"
                        type="button"
                        disabled={!canAddToCollections}
                        onClick={() => handleAddFromDict(entry, existingCard)}
                      >
                        {actionLabel}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            !dictLoading && dictStatus && <p className="muted">{dictStatus}</p>
          )}
          {!isOnline && downloadedDatasets.length === 0 && !dictStatus && (
            <p className="muted">Download a dataset to enable offline search.</p>
          )}
          {actionStatus && <p className="muted">{actionStatus}</p>}
        </div>
      </div>
    </section>
  );
}
