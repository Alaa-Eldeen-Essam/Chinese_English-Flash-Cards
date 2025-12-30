import React, { useEffect, useState } from "react";

import { createCollection, searchCards } from "../api/client";
import type { Card, Collection } from "../types";
import { useAppStore } from "../store/AppStore";

function createLocalId(): number {
  return -Math.floor(Date.now() / 1000);
}

export default function Collections(): JSX.Element {
  const { userData, updateUserData, enqueueAction, isOnline } = useAppStore();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<Collection | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [status, setStatus] = useState<string | null>(null);

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
        {selected && !isOnline && (
          <p className="muted">Collection card lists require an online sync.</p>
        )}
        {selected && isOnline && cards.length === 0 && (
          <p className="muted">No cards in this collection yet.</p>
        )}
        {cards.length > 0 && (
          <ul className="list">
            {cards.map((card) => (
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
