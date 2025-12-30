import React, { useMemo, useState } from "react";

import { createCard } from "../api/client";
import type { Card } from "../types";
import { useAppStore } from "../store/AppStore";

function createLocalCardId(): number {
  return -Math.floor(Date.now() / 1000);
}

export default function CardEditor(): JSX.Element {
  const { userData, updateUserData, enqueueAction, isOnline } = useAppStore();
  const [simplified, setSimplified] = useState("");
  const [pinyin, setPinyin] = useState("");
  const [meanings, setMeanings] = useState("");
  const [tags, setTags] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string | null>(null);

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

  function applySuggestion(card: Card) {
    setSimplified(card.simplified);
    setPinyin(card.pinyin);
    setMeanings(card.meanings.join("; "));
    setTags(card.tags.join(", "));
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
      examples: [] as string[]
    };

    setStatus(null);

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
      easiness: 2.5,
      interval_days: 0,
      repetitions: 0,
      next_due: now,
      collection_ids: [],
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
  }

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
            <button className="primary" type="submit">
              Save card
            </button>
            {status && <p className="muted">{status}</p>}
          </form>
        </div>

        <div className="panel">
          <h2>Dictionary lookup</h2>
          <p className="muted">
            Search your local data for now. Hook this to the imported dictionary later.
          </p>
          <input
            placeholder="Search simplified or pinyin"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {suggestions.length > 0 ? (
            <ul className="list selectable">
              {suggestions.map((card) => (
                <li key={card.id} onClick={() => applySuggestion(card)}>
                  <span>{card.simplified}</span>
                  <span className="muted">{card.pinyin}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No matches yet. Import dictionary data to expand.</p>
          )}
        </div>
      </div>
    </section>
  );
}
