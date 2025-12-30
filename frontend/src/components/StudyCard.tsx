import React, { useEffect, useMemo, useState } from "react";

import type { Card } from "../types";
import { splitPinyin } from "../utils/pinyin";
import { speakChinese } from "../utils/tts";
import { useAuthStore } from "../store/AuthStore";

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
  const { user } = useAuthStore();

  const settings = user?.settings ?? {};
  const toneColors = settings["tone_colors"] !== false;
  const autoTts = settings["auto_tts"] === true;

  const pinyinParts = useMemo(() => splitPinyin(card.pinyin || ""), [card.pinyin]);

  useEffect(() => {
    setFlipped(false);
  }, [card.id]);

  useEffect(() => {
    if (autoTts) {
      speakChinese(card.simplified);
    }
  }, [autoTts, card.id, card.simplified]);

  const pinyinDisplay = toneColors && pinyinParts.length > 0 ? (
    <span>
      {pinyinParts.map((part, index) => {
        if (!part.text.trim()) {
          return <span key={`space-${index}`}>{part.text}</span>;
        }
        const toneClass = `tone-${part.tone || 0}`;
        return (
          <span key={`${part.text}-${index}`} className={toneClass}>
            {part.text}
          </span>
        );
      })}
    </span>
  ) : (
    card.pinyin || "(pinyin missing)"
  );

  return (
    <div className="study-card">
      <div className={flipped ? "card-inner flipped" : "card-inner"}>
        <div className="card-face card-front">
          <div className="card-title">{card.simplified}</div>
          <div className="card-subtitle">Tap to reveal</div>
          <button className="secondary listen-button" onClick={() => speakChinese(card.simplified)}>
            Listen
          </button>
        </div>
        <div className="card-face card-back">
          <div className="card-title">{pinyinDisplay}</div>
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
            {card.examples.length > 0 && (
              <p className="muted example-line">{card.examples[0]}</p>
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
