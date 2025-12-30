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

type AccuracyRow = {
  label: string;
  total: number;
  correct: number;
  accuracy: number;
};

function normalizeTag(tag: string): string {
  return tag.trim();
}

export function getAccuracyByTagPrefix(
  cards: Card[],
  logs: StudyLog[],
  prefix: string,
  limit: number
): AccuracyRow[] {
  const cardTags = new Map<number, string[]>();
  cards.forEach((card) => {
    cardTags.set(card.id, (card.tags ?? []).map(normalizeTag));
  });

  const stats = new Map<string, { total: number; correct: number }>();
  logs.forEach((log) => {
    const tags = cardTags.get(log.card_id) ?? [];
    tags.forEach((tag) => {
      const match =
        prefix === "HSK"
          ? tag.toUpperCase().startsWith("HSK")
          : tag.toLowerCase().startsWith(prefix.toLowerCase());
      if (!match) {
        return;
      }
      const key = prefix === "HSK" ? tag.toUpperCase() : tag;
      const current = stats.get(key) ?? { total: 0, correct: 0 };
      current.total += 1;
      if (log.correct) {
        current.correct += 1;
      }
      stats.set(key, current);
    });
  });

  return Array.from(stats.entries())
    .map(([label, stat]) => ({
      label,
      total: stat.total,
      correct: stat.correct,
      accuracy: stat.total ? Math.round((stat.correct / stat.total) * 100) : 0
    }))
    .sort((a, b) => b.accuracy - a.accuracy)
    .slice(0, limit);
}

export function getAvgResponseTimes(logs: StudyLog[], days: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const buckets = new Map<string, { total: number; count: number }>();

  logs.forEach((log) => {
    const date = new Date(log.timestamp);
    const key = toDateKey(date);
    const current = buckets.get(key) ?? { total: 0, count: 0 };
    current.total += log.response_time_ms;
    current.count += 1;
    buckets.set(key, current);
  });

  const result: Array<{ date: string; label: string; ms: number }> = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date(today.getTime() - i * DAY_MS);
    const key = toDateKey(day);
    const stats = buckets.get(key);
    const avg = stats && stats.count > 0 ? Math.round(stats.total / stats.count) : 0;
    result.push({
      date: key,
      label: day.toLocaleDateString(undefined, { weekday: "short" }),
      ms: avg
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
