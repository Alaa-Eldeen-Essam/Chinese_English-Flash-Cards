import React, { useEffect, useMemo, useState } from "react";

import type { Card, StudyMode } from "../types";
import { normalizePinyinInput, splitPinyin } from "../utils/pinyin";
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
  mode: StudyMode;
};

function normalizeHanzi(value: string): string {
  return value.replace(/\s+/g, "");
}

function isCjk(value: string): boolean {
  return /[\u4e00-\u9fff]/.test(value);
}

function normalizePinyinCard(pinyin: string): string {
  return normalizePinyinInput(pinyin);
}

function buildCloze(example: string, target: string): string {
  if (!example || !target) {
    return "";
  }
  if (example.includes(target)) {
    return example.replace(target, "____");
  }
  return "";
}

export default function StudyCard({ card, onRate, mode }: StudyCardProps): JSX.Element {
  const [flipped, setFlipped] = useState(false);
  const [answer, setAnswer] = useState("");
  const [checked, setChecked] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const { user } = useAuthStore();

  const settings = user?.settings ?? {};
  const toneColors = settings["tone_colors"] !== false;
  const autoTts = settings["auto_tts"] === true;

  const pinyinParts = useMemo(() => splitPinyin(card.pinyin || ""), [card.pinyin]);
  const example = card.examples[0] ?? "";
  const cloze = buildCloze(example, card.simplified);
  const showAnswerInput = mode === "typing" || mode === "cloze";
  const canRate = showAnswerInput ? checked : flipped;

  useEffect(() => {
    setFlipped(false);
    setAnswer("");
    setChecked(false);
    setIsCorrect(false);
  }, [card.id]);

  useEffect(() => {
    if (autoTts || mode === "listening") {
      speakChinese(card.simplified);
    }
  }, [autoTts, mode, card.id, card.simplified]);

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

  function handleCheck() {
    const trimmed = answer.trim();
    if (!trimmed) {
      return;
    }
    let correct = false;
    if (isCjk(trimmed)) {
      correct = normalizeHanzi(trimmed) === normalizeHanzi(card.simplified);
    } else if (card.pinyin) {
      correct = normalizePinyinInput(trimmed) === normalizePinyinCard(card.pinyin);
    }
    setIsCorrect(correct);
    setChecked(true);
    if (!flipped) {
      setFlipped(true);
    }
  }

  return (
    <div className="study-card">
      <div className={flipped ? "card-inner flipped" : "card-inner"}>
        <div className="card-face card-front">
          {mode === "listening" ? (
            <>
              <div className="card-title">Listen</div>
              <div className="card-subtitle">Hear the audio, then reveal.</div>
              <button
                className="secondary listen-button"
                onClick={() => speakChinese(card.simplified)}
              >
                Play audio
              </button>
            </>
          ) : mode === "cloze" && cloze ? (
            <>
              <div className="card-title">{cloze}</div>
              <div className="card-subtitle">Fill the missing word.</div>
            </>
          ) : (
            <>
              <div className="card-title">{card.simplified}</div>
              <div className="card-subtitle">Tap to reveal</div>
              <button
                className="secondary listen-button"
                onClick={() => speakChinese(card.simplified)}
              >
                Listen
              </button>
            </>
          )}
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

      {showAnswerInput && (
        <div className="answer-block">
          <label>
            {mode === "typing" ? "Type the answer" : "Fill the blank"}
            <input
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              placeholder={mode === "typing" ? "Hanzi or pinyin" : "Missing word"}
            />
          </label>
          <div className="inline-meta">
            <button className="secondary" onClick={handleCheck} disabled={!answer.trim()}>
              Check
            </button>
            {checked && (
              <span className={isCorrect ? "status-pill online" : "status-pill offline"}>
                {isCorrect ? "Correct" : "Try again"}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="study-actions">
        <button className="secondary" onClick={() => setFlipped((prev) => !prev)}>
          {flipped ? "Hide" : "Reveal"}
        </button>
        <div className="quality-buttons">
          {qualityButtons.map((button) => (
            <button key={button.label} onClick={() => onRate(button.value)} disabled={!canRate}>
              {button.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
