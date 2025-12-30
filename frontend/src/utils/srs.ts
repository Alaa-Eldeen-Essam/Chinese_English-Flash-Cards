import type { Flashcard, ReviewRating } from "../types";

export function scheduleNext(
  card: Flashcard,
  rating: ReviewRating,
  now: Date = new Date()
): Flashcard {
  let repetition = card.repetition;
  let intervalDays = card.intervalDays;
  let easeFactor = card.easeFactor;

  if (rating < 3) {
    repetition = 0;
    intervalDays = 1;
  } else {
    if (repetition === 0) {
      intervalDays = 1;
    } else if (repetition === 1) {
      intervalDays = 6;
    } else {
      intervalDays = Math.round(intervalDays * easeFactor);
    }
    repetition += 1;
  }

  const delta = 0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02);
  easeFactor = Math.max(1.3, easeFactor + delta);

  const dueAt = new Date(now);
  dueAt.setDate(dueAt.getDate() + intervalDays);

  return {
    ...card,
    repetition,
    intervalDays,
    easeFactor,
    dueAt: dueAt.toISOString()
  };
}
