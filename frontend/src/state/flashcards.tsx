import React, { createContext, useContext, useMemo, useState } from "react";
import type { Flashcard, ReviewRating } from "../types";
import { scheduleNext } from "../utils/srs";

const seedCards: Flashcard[] = [
  {
    id: "1",
    hanzi: "NI HAO",
    pinyin: "ni3 hao3",
    english: "hello",
    easeFactor: 2.5,
    intervalDays: 0,
    repetition: 0,
    dueAt: new Date().toISOString()
  }
];

type FlashcardContextValue = {
  cards: Flashcard[];
  currentCard: Flashcard | null;
  remainingCount: number;
  reviewCard: (rating: ReviewRating) => void;
  resetSession: () => void;
};

const FlashcardContext = createContext<FlashcardContextValue | null>(null);

function isDue(card: Flashcard, now: Date): boolean {
  return new Date(card.dueAt) <= now;
}

function sortByDue(a: Flashcard, b: Flashcard): number {
  return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
}

export function FlashcardProvider({
  children
}: {
  children: React.ReactNode;
}): JSX.Element {
  const [cards, setCards] = useState<Flashcard[]>(seedCards);

  const { dueCards, currentCard } = useMemo(() => {
    const now = new Date();
    const dueCards = cards.filter((card) => isDue(card, now)).sort(sortByDue);
    return {
      dueCards,
      currentCard: dueCards[0] ?? null
    };
  }, [cards]);

  function reviewCard(rating: ReviewRating): void {
    if (!currentCard) {
      return;
    }

    setCards((prev) =>
      prev.map((card) =>
        card.id === currentCard.id ? scheduleNext(card, rating) : card
      )
    );
  }

  function resetSession(): void {
    setCards(seedCards);
  }

  const value = {
    cards,
    currentCard,
    remainingCount: dueCards.length,
    reviewCard,
    resetSession
  };

  return (
    <FlashcardContext.Provider value={value}>
      {children}
    </FlashcardContext.Provider>
  );
}

export function useFlashcards(): FlashcardContextValue {
  const ctx = useContext(FlashcardContext);
  if (!ctx) {
    throw new Error("useFlashcards must be used within FlashcardProvider");
  }
  return ctx;
}
