import React, { useMemo } from "react";

import StatCard from "../components/StatCard";
import type { PageId } from "./pageTypes";
import { useAppStore } from "../store/AppStore";
import {
  computeStreak,
  getAccuracyByTagPrefix,
  getAvgResponseTimes,
  getDailyReviewCounts,
  getWeakCards
} from "../utils/stats";

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
  const streak = computeStreak(userData.study_logs);
  const reviewCounts = getDailyReviewCounts(userData.study_logs, 7);
  const weakCards = getWeakCards(userData.cards, userData.study_logs, 5);
  const accuracyByHsk = getAccuracyByTagPrefix(userData.cards, userData.study_logs, "HSK", 4);
  const accuracyByPos = getAccuracyByTagPrefix(userData.cards, userData.study_logs, "pos:", 4);
  const responseTimes = getAvgResponseTimes(userData.study_logs, 7);

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
        <StatCard label="Streak" value={`${streak} days`} hint="Consecutive review days" />
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

      <div className="panel-grid">
        <div className="panel">
          <h2>Review heatmap</h2>
          <div className="heatmap">
            {reviewCounts.map((day) => (
              <div key={day.date} className="heatmap-cell">
                <div
                  className="heatmap-bar"
                  style={{ height: `${Math.min(100, day.count * 12)}%` }}
                />
                <span className="muted">{day.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <h2>Weak words</h2>
          {weakCards.length === 0 ? (
            <p className="muted">No weak cards yet. Keep studying.</p>
          ) : (
            <ul className="list">
              {weakCards.map((card) => (
                <li key={card.id}>
                  <span>{card.simplified}</span>
                  <span className="muted">{card.pinyin}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="panel-grid">
        <div className="panel">
          <h2>Accuracy by HSK</h2>
          {accuracyByHsk.length === 0 ? (
            <p className="muted">No tagged reviews yet.</p>
          ) : (
            <div className="metric-list">
              {accuracyByHsk.map((row) => (
                <div key={row.label} className="metric-row">
                  <span>{row.label}</span>
                  <div className="metric-bar">
                    <div className="metric-bar-fill" style={{ width: `${row.accuracy}%` }} />
                  </div>
                  <span className="muted">{row.accuracy}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="panel">
          <h2>Accuracy by POS</h2>
          {accuracyByPos.length === 0 ? (
            <p className="muted">No part-of-speech tags yet.</p>
          ) : (
            <div className="metric-list">
              {accuracyByPos.map((row) => (
                <div key={row.label} className="metric-row">
                  <span>{row.label.replace("pos:", "")}</span>
                  <div className="metric-bar">
                    <div className="metric-bar-fill" style={{ width: `${row.accuracy}%` }} />
                  </div>
                  <span className="muted">{row.accuracy}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="panel">
        <h2>Response time trend</h2>
        <div className="response-grid">
          {responseTimes.map((day) => (
            <div key={day.date} className="response-cell">
              <div className="response-bar" style={{ height: `${Math.min(100, day.ms / 30)}px` }} />
              <span className="muted">{day.label}</span>
              <span className="muted">{day.ms} ms</span>
            </div>
          ))}
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
