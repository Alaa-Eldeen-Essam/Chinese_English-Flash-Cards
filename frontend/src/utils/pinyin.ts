type ToneInfo = {
  text: string;
  tone: number;
};

const TONE_MARKS: Record<string, number> = {
  "ā": 1,
  "á": 2,
  "ǎ": 3,
  "à": 4,
  "ē": 1,
  "é": 2,
  "ě": 3,
  "è": 4,
  "ī": 1,
  "í": 2,
  "ǐ": 3,
  "ì": 4,
  "ō": 1,
  "ó": 2,
  "ǒ": 3,
  "ò": 4,
  "ū": 1,
  "ú": 2,
  "ǔ": 3,
  "ù": 4,
  "ǖ": 1,
  "ǘ": 2,
  "ǚ": 3,
  "ǜ": 4,
  "ü": 0
};

function detectTone(token: string): number {
  const numberMatch = token.match(/[1-5]/);
  if (numberMatch) {
    return Number(numberMatch[0]);
  }
  for (const char of token) {
    if (TONE_MARKS[char]) {
      return TONE_MARKS[char];
    }
  }
  return 0;
}

export function splitPinyin(pinyin: string): ToneInfo[] {
  if (!pinyin.trim()) {
    return [];
  }
  const parts = pinyin.split(/(\s+)/);
  return parts.map((part) => ({
    text: part,
    tone: part.trim() ? detectTone(part) : 0
  }));
}
