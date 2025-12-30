import React, { useMemo } from "react";

import StatCard from "../components/StatCard";
import type { PageId } from "./pageTypes";
import { useAppStore } from "../store/AppStore";

function isDue(dueAt: string): boolean {
  return new Date(dueAt).getTime() <= Date.now();
}

function countToday(stamps: string[]): number {
  const today = new Date();
  return stamps.filter((stamp) => {
    const date = new Date(stamp);
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  }).length;
}

type HomeProps = {
  onNavigate: (page: PageId) => void;
};

export default function Home({ onNavigate }: HomeProps): JSX.Element {
  const { userData, isOnline, queue, lastSyncAt } = useAppStore();

  const { dueCards, upcomingCards } = useMemo(() => {
    const due = userData.cards.filter((card) => isDue(card.next_due));
    const upcoming = [...userData.cards]
      .filter((card) => !isDue(card.next_due))
      .sort((a, b) => a.next_due.localeCompare(b.next_due))
      .slice(0, 3);
    return { dueCards: due, upcomingCards: upcoming };
  }, [userData.cards]);

  const totalCards = userData.cards.length;
  const dueCount = dueCards.length;
  const reviewsToday = countToday(userData.study_logs.map((log) => log.timestamp));

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>
            {isOnline
              ? "Live data from your device and the API."
              : "Offline mode: updates will sync when you reconnect."}
          </p>
        </div>
        <button className="primary" onClick={() => onNavigate("study")}>
          Start a session
        </button>
      </header>

      <div className="stat-grid">
        <StatCard label="Due now" value={dueCount} hint="Ready for review" />
        <StatCard label="Total cards" value={totalCards} hint="Across all decks" />
        <StatCard label="Reviews today" value={reviewsToday} hint="Keep momentum" />
        <StatCard label="Queued actions" value={queue.length} hint="Offline changes" />
      </div>

      <div className="panel-grid">
        <div className="panel">
          <h2>Next up</h2>
          {dueCards.slice(0, 3).length > 0 ? (
            <ul className="list">
              {dueCards.slice(0, 3).map((card) => (
                <li key={card.id}>
                  <span>{card.simplified}</span>
                  <span className="muted">Due now</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Nothing due. Check upcoming cards.</p>
          )}
        </div>
        <div className="panel">
          <h2>Upcoming</h2>
          {upcomingCards.length > 0 ? (
            <ul className="list">
              {upcomingCards.map((card) => (
                <li key={card.id}>
                  <span>{card.simplified}</span>
                  <span className="muted">{new Date(card.next_due).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Schedule a study session to unlock new due cards.</p>
          )}
        </div>
      </div>

      <div className="panel">
        <h2>Sync status</h2>
        <div className="inline-meta">
          <span>Mode: {isOnline ? "Online" : "Offline"}</span>
          <span>Last sync: {lastSyncAt ? new Date(lastSyncAt).toLocaleString() : "Not yet"}</span>
        </div>
      </div>
    </section>
  );
}
