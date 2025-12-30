import type { Card, StudyLog } from "../types";

const DAY_MS = 24 * 60 * 60 * 1000;

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function computeStreak(logs: StudyLog[]): number {
  if (logs.length === 0) {
    return 0;
  }
  const byDay = new Set(logs.map((log) => toDateKey(new Date(log.timestamp))));
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < 365; i += 1) {
    const day = new Date(today.getTime() - i * DAY_MS);
    if (byDay.has(toDateKey(day))) {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
}

export function getDailyReviewCounts(logs: StudyLog[], days: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const counts = new Map<string, number>();
  logs.forEach((log) => {
    const key = toDateKey(new Date(log.timestamp));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  const result: Array<{ date: string; label: string; count: number }> = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date(today.getTime() - i * DAY_MS);
    const key = toDateKey(day);
    result.push({
      date: key,
      label: day.toLocaleDateString(undefined, { weekday: "short" }),
      count: counts.get(key) ?? 0
    });
  }
  return result;
}

export function getWeakCards(cards: Card[], logs: StudyLog[], limit: number) {
  const lastScores = new Map<number, { ease: number; timestamp: number }>();
  logs.forEach((log) => {
    const time = new Date(log.timestamp).getTime();
    const existing = lastScores.get(log.card_id);
    if (!existing || time > existing.timestamp) {
      lastScores.set(log.card_id, { ease: log.ease, timestamp: time });
    }
  });

  const scored = cards.map((card) => {
    const lastEase = lastScores.get(card.id)?.ease ?? 3;
    const penalty = lastEase < 3 ? 1 : 0;
    const score = (2.7 - card.easiness) + penalty;
    return { card, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .filter((item) => item.score > 0.1)
    .slice(0, limit)
    .map((item) => item.card);
}
