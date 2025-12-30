import type { Card, UserData } from "../types";

export function createEmptyUserData(): UserData {
  return {
    user: {
      id: 0,
      username: "offline",
      settings: {}
    },
    collections: [],
    cards: [],
    study_logs: [],
    last_modified: new Date().toISOString()
  };
}

export function replaceCard(cards: Card[], nextCard: Card): Card[] {
  const index = cards.findIndex((card) => card.id === nextCard.id);
  if (index === -1) {
    return [...cards, nextCard];
  }
  const updated = [...cards];
  updated[index] = nextCard;
  return updated;
}
