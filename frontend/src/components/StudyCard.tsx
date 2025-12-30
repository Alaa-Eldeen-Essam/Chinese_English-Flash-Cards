import React, { useState } from "react";

import type { Card } from "../types";

const qualityButtons = [
  { label: "Again", value: 1 },
  { label: "Hard", value: 3 },
  { label: "Good", value: 4 },
  { label: "Easy", value: 5 }
];

type StudyCardProps = {
  card: Card;
  onRate: (quality: number) => void;
};

export default function StudyCard({ card, onRate }: StudyCardProps): JSX.Element {
  const [flipped, setFlipped] = useState(false);

  return (
    <div className="study-card">
      <div className={flipped ? "card-inner flipped" : "card-inner"}>
        <div className="card-face card-front">
          <div className="card-title">{card.simplified}</div>
          <div className="card-subtitle">Tap to reveal</div>
        </div>
        <div className="card-face card-back">
          <div className="card-title">{card.pinyin || "(pinyin missing)"}</div>
          <div className="card-body">
            {card.meanings.length > 0 ? (
              <ul>
                {card.meanings.slice(0, 3).map((meaning) => (
                  <li key={meaning}>{meaning}</li>
                ))}
              </ul>
            ) : (
              <p>No meanings yet</p>
            )}
          </div>
        </div>
      </div>

      <div className="study-actions">
        <button className="secondary" onClick={() => setFlipped((prev) => !prev)}>
          {flipped ? "Hide" : "Reveal"}
        </button>
        <div className="quality-buttons">
          {qualityButtons.map((button) => (
            <button key={button.label} onClick={() => onRate(button.value)}>
              {button.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
