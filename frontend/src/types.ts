export type ReviewRating = 0 | 1 | 2 | 3 | 4 | 5;

export type Flashcard = {
  id: string;
  hanzi: string;
  pinyin: string;
  english: string;
  easeFactor: number;
  intervalDays: number;
  repetition: number;
  dueAt: string;
};

export type ReviewResult = {
  updatedCard: Flashcard;
  nextDueAt: string;
};
