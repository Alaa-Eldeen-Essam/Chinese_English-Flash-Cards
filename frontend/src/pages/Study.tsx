import React, { useEffect, useMemo, useState } from "react";

import StudyCard from "../components/StudyCard";
import { getSchedule } from "../api/client";
import type { Card } from "../types";
import { useAppStore } from "../store/AppStore";
import { useSRS } from "../hooks/useSRS";

function isDue(card: Card): boolean {
  return new Date(card.next_due).getTime() <= Date.now();
}

export default function Study(): JSX.Element {
  const { userData, isOnline } = useAppStore();
  const { recordReview } = useSRS();
  const [queue, setQueue] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState(Date.now());

  const fallbackQueue = useMemo(() => {
    return [...userData.cards]
      .filter(isDue)
      .sort((a, b) => a.next_due.localeCompare(b.next_due))
      .slice(0, 20);
  }, [userData.cards]);

  useEffect(() => {
    let mounted = true;
    async function loadSchedule() {
      setLoading(true);
      setError(null);
      if (isOnline) {
        try {
          const response = await getSchedule({ n: 20 });
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
  }, [isOnline, fallbackQueue]);

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
        </div>
      </header>

      {loading ? (
        <div className="panel">Loading schedule...</div>
      ) : currentCard ? (
        <div className="panel">
          {error && <p className="muted">{error}</p>}
          <StudyCard card={currentCard} onRate={handleRate} />
        </div>
      ) : (
        <div className="panel empty">
          <h2>All done</h2>
          <p>No cards due right now. Come back later or import more vocab.</p>
        </div>
      )}
    </section>
  );
}
