import React, { useState } from "react";
import type { Flashcard as FlashcardType, ReviewRating } from "../types";

const ratingButtons: Array<{ label: string; value: ReviewRating }> = [
  { label: "Again", value: 0 },
  { label: "Hard", value: 3 },
  { label: "Good", value: 4 },
  { label: "Easy", value: 5 }
];

type FlashcardProps = {
  card: FlashcardType;
  onRate: (rating: ReviewRating) => void;
};

export default function Flashcard({ card, onRate }: FlashcardProps): JSX.Element {
  const [showAnswer, setShowAnswer] = useState(false);

  function handleRate(rating: ReviewRating): void {
    onRate(rating);
    setShowAnswer(false);
  }

  return (
    <div className="flashcard">
      <div className="hanzi">{card.hanzi}</div>
      <div className="pinyin">{showAnswer ? card.pinyin : "..."}</div>
      <div className="english">{showAnswer ? card.english : "Tap reveal"}</div>

      <div className="badges">
        <span>Ease {card.easeFactor.toFixed(2)}</span>
        <span>Interval {card.intervalDays}d</span>
      </div>

      <div className="controls">
        {!showAnswer ? (
          <button className="secondary" onClick={() => setShowAnswer(true)}>
            Reveal answer
          </button>
        ) : (
          ratingButtons.map((rating) => (
            <button key={rating.label} onClick={() => handleRate(rating.value)}>
              {rating.label}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
