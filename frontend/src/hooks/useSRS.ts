import { useCallback } from "react";

import { submitStudyResponse } from "../api/client";
import type { Card, StudyLog } from "../types";
import { replaceCard } from "../utils/data";
import { useAppStore } from "../store/AppStore";

function createId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function applySm2(card: Card, quality: number, now: Date): Card {
  let repetitions = card.repetitions;
  let intervalDays = card.interval_days;
  let easiness = card.easiness;

  if (quality < 3) {
    repetitions = 0;
    intervalDays = 1;
  } else {
    repetitions += 1;
    if (repetitions === 1) {
      intervalDays = 1;
    } else if (repetitions === 2) {
      intervalDays = 6;
    } else {
      intervalDays = Math.round(intervalDays * easiness);
    }
  }

  const delta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
  easiness = Math.max(1.3, easiness + delta);

  const dueAt = new Date(now);
  dueAt.setDate(dueAt.getDate() + intervalDays);

  return {
    ...card,
    repetitions,
    interval_days: intervalDays,
    easiness,
    next_due: dueAt.toISOString(),
    last_modified: now.toISOString()
  };
}

export function useSRS() {
  const { userData, updateUserData, enqueueAction, isOnline } = useAppStore();

  const recordReview = useCallback(
    async (card: Card, quality: number, responseTimeMs: number) => {
      const now = new Date();
      if (isOnline) {
        try {
          const response = await submitStudyResponse({
            card_id: card.id,
            q: quality,
            response_time_ms: responseTimeMs,
            user_id: "me"
          });

          const log: StudyLog = {
            id: Number(now),
            card_id: card.id,
            user_id: userData.user.id,
            timestamp: response.logged_at,
            ease: quality,
            correct: quality >= 3,
            response_time_ms: responseTimeMs,
            last_modified: new Date().toISOString()
          };

          const updated = {
            ...userData,
            cards: replaceCard(userData.cards, response.card),
            study_logs: [...userData.study_logs, log],
            last_modified: new Date().toISOString()
          };

          updateUserData(updated);
          return { card: response.card, queued: false };
        } catch {
          // Fall back to offline behavior
        }
      }

      const updatedCard = applySm2(card, quality, now);
      const log: StudyLog = {
        id: Number(now),
        card_id: card.id,
        user_id: userData.user.id,
        timestamp: now.toISOString(),
        ease: quality,
        correct: quality >= 3,
        response_time_ms: responseTimeMs,
        last_modified: now.toISOString()
      };

      const updated = {
        ...userData,
        cards: replaceCard(userData.cards, updatedCard),
        study_logs: [...userData.study_logs, log],
        last_modified: now.toISOString()
      };

      updateUserData(updated);

      await enqueueAction({
        id: createId(),
        type: "study",
        payload: log,
        created_at: now.toISOString()
      });

      await enqueueAction({
        id: createId(),
        type: "update_card",
        payload: updatedCard,
        created_at: now.toISOString()
      });

      return { card: updatedCard, queued: true };
    },
    [enqueueAction, isOnline, updateUserData, userData]
  );

  return { recordReview };
}
