from __future__ import annotations

import csv
import gzip
import json
import re
from datetime import datetime
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Iterator, List, Optional

from sqlalchemy.orm import Session

from ..models import DictWord

CEDICT_PATTERN = re.compile(
    r"^(?P<trad>\S+)\s+(?P<simp>\S+)\s+\[(?P<pinyin>[^\]]+)\]\s+/(?P<defs>.+)/$"
)

TONE_MARKS = {
    "\u0101": ("a", 1),
    "\u00e1": ("a", 2),
    "\u01ce": ("a", 3),
    "\u00e0": ("a", 4),
    "\u0113": ("e", 1),
    "\u00e9": ("e", 2),
    "\u011b": ("e", 3),
    "\u00e8": ("e", 4),
    "\u012b": ("i", 1),
    "\u00ed": ("i", 2),
    "\u01d0": ("i", 3),
    "\u00ec": ("i", 4),
    "\u014d": ("o", 1),
    "\u00f3": ("o", 2),
    "\u01d2": ("o", 3),
    "\u00f2": ("o", 4),
    "\u016b": ("u", 1),
    "\u00fa": ("u", 2),
    "\u01d4": ("u", 3),
    "\u00f9": ("u", 4),
    "\u01d6": ("v", 1),
    "\u01d8": ("v", 2),
    "\u01da": ("v", 3),
    "\u01dc": ("v", 4),
    "\u00fc": ("v", 0)
}

DIACRITIC_MAP = {
    ("a", 1): "\u0101",
    ("a", 2): "\u00e1",
    ("a", 3): "\u01ce",
    ("a", 4): "\u00e0",
    ("e", 1): "\u0113",
    ("e", 2): "\u00e9",
    ("e", 3): "\u011b",
    ("e", 4): "\u00e8",
    ("i", 1): "\u012b",
    ("i", 2): "\u00ed",
    ("i", 3): "\u01d0",
    ("i", 4): "\u00ec",
    ("o", 1): "\u014d",
    ("o", 2): "\u00f3",
    ("o", 3): "\u01d2",
    ("o", 4): "\u00f2",
    ("u", 1): "\u016b",
    ("u", 2): "\u00fa",
    ("u", 3): "\u01d4",
    ("u", 4): "\u00f9",
    ("v", 1): "\u01d6",
    ("v", 2): "\u01d8",
    ("v", 3): "\u01da",
    ("v", 4): "\u01dc"
}

VOWELS = ["a", "e", "i", "o", "u", "v"]


@dataclass
class DictEntry:
    simplified: str
    traditional: str
    pinyin: str
    meanings: list[str]
    examples: list[str]
    tags: list[str]
    pinyin_normalized: str = ""
    hsk_level: Optional[int] = None
    pos: Optional[str] = None
    frequency: Optional[float] = None


@dataclass
class ImportStats:
    parsed: int
    normalized: int
    deduped: int
    inserted: int


@dataclass
class CsvMapping:
    simplified: str
    traditional: Optional[str] = None
    pinyin: Optional[str] = None
    meanings: Optional[str] = None
    examples: Optional[str] = None
    tags: Optional[str] = None
    hsk_level: Optional[str] = None
    frequency: Optional[str] = None
    part_of_speech: Optional[str] = None


def open_text(path: Path) -> Iterator[str]:
    if path.suffix == ".gz":
        with gzip.open(path, "rt", encoding="utf-8") as f:
            yield from f
    else:
        with open(path, "r", encoding="utf-8") as f:
            yield from f


def split_values(raw: str) -> list[str]:
    if not raw:
        return []
    parts = re.split(r"[;|,]", raw)
    return [part.strip() for part in parts if part.strip()]


def parse_cedict_file(path: Path) -> list[DictEntry]:
    entries: list[DictEntry] = []
    for line in open_text(path):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        match = CEDICT_PATTERN.match(line)
        if not match:
            continue
        defs_raw = match.group("defs")
        meanings = [d for d in defs_raw.split("/") if d]
        entries.append(
            DictEntry(
                simplified=match.group("simp"),
                traditional=match.group("trad"),
                pinyin=match.group("pinyin"),
                meanings=meanings,
                examples=[],
                tags=[]
            )
        )
    return entries


def parse_csv_file(path: Path, mapping: CsvMapping) -> list[DictEntry]:
    entries: list[DictEntry] = []
    with open(path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            simplified = (row.get(mapping.simplified) or "").strip()
            if not simplified:
                continue
            traditional = (row.get(mapping.traditional or "") or "").strip()
            pinyin = (row.get(mapping.pinyin or "") or "").strip()
            meanings = split_values(row.get(mapping.meanings or "") or "")
            examples = split_values(row.get(mapping.examples or "") or "")
            tags = split_values(row.get(mapping.tags or "") or "")

            hsk_level = None
            if mapping.hsk_level:
                raw_level = (row.get(mapping.hsk_level) or "").strip()
                match = re.search(r"([1-9])", raw_level)
                if match:
                    hsk_level = int(match.group(1))

            frequency = None
            if mapping.frequency:
                raw_frequency = (row.get(mapping.frequency) or "").strip()
                if raw_frequency:
                    try:
                        frequency = float(raw_frequency)
                    except ValueError:
                        frequency = None

            pos = None
            if mapping.part_of_speech:
                pos = (row.get(mapping.part_of_speech) or "").strip() or None

            entries.append(
                DictEntry(
                    simplified=simplified,
                    traditional=traditional,
                    pinyin=pinyin,
                    meanings=meanings,
                    examples=examples,
                    tags=tags,
                    hsk_level=hsk_level,
                    pos=pos,
                    frequency=frequency
                )
            )
    return entries


def normalize_pinyin_search(pinyin: str) -> str:
    if not pinyin:
        return ""
    normalized = normalize_pinyin(pinyin, style="numbers").lower()
    normalized = re.sub(r"[1-5]", "", normalized)
    normalized = normalized.replace("u:", "v").replace("\u00fc", "v")
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return normalized


def extract_hsk_level(tags: Iterable[str]) -> Optional[int]:
    for tag in tags:
        match = re.match(r"^hsk\s*([1-9])$", tag.strip(), re.IGNORECASE)
        if match:
            return int(match.group(1))
    return None


def extract_pos(tags: Iterable[str]) -> Optional[str]:
    for tag in tags:
        lower = tag.strip().lower()
        if lower.startswith("pos:"):
            value = tag.split(":", 1)[1].strip()
            if value:
                return value
    return None


def extract_frequency(tags: Iterable[str]) -> Optional[float]:
    for tag in tags:
        lower = tag.strip().lower()
        if lower.startswith("freq:"):
            raw = tag.split(":", 1)[1].strip()
            if raw:
                try:
                    return float(raw)
                except ValueError:
                    return None
    return None


def normalize_pinyin(pinyin: str, style: str = "numbers") -> str:
    if not pinyin:
        return pinyin

    tokens = pinyin.strip().split()
    normalized: list[str] = []

    for token in tokens:
        if style == "numbers":
            normalized.append(_to_numbers(token))
        elif style == "diacritics":
            normalized.append(_to_diacritics(token))
        else:
            normalized.append(token)

    return " ".join(normalized)


def _to_numbers(token: str) -> str:
    if re.search(r"\d", token):
        return token.replace("u:", "v").replace("\u00fc", "v")

    tone = 0
    chars: list[str] = []
    for char in token:
        if char in TONE_MARKS:
            base, tone_value = TONE_MARKS[char]
            chars.append(base)
            if tone_value:
                tone = tone_value
        else:
            chars.append(char)

    core = "".join(chars).replace("u:", "v")
    return f"{core}{tone}" if tone else core


def _to_diacritics(token: str) -> str:
    match = re.match(r"^(?P<body>[a-zv:]+)(?P<tone>[1-5])$", token, re.IGNORECASE)
    if not match:
        return token.replace("v", "\u00fc")

    body = match.group("body").replace("u:", "v").lower()
    tone = int(match.group("tone"))
    if tone == 5:
        return body.replace("v", "\u00fc")

    vowel_index = _select_vowel_index(body)
    if vowel_index is None:
        return body

    vowel = body[vowel_index]
    diacritic = DIACRITIC_MAP.get((vowel, tone))
    if not diacritic:
        return body

    return body[:vowel_index] + diacritic + body[vowel_index + 1 :]


def _select_vowel_index(body: str) -> Optional[int]:
    if "a" in body:
        return body.index("a")
    if "e" in body:
        return body.index("e")
    if "ou" in body:
        return body.index("o")

    for i in range(len(body) - 1, -1, -1):
        if body[i] in VOWELS:
            return i
    return None


def normalize_entries(entries: Iterable[DictEntry], pinyin_style: str) -> list[DictEntry]:
    normalized: list[DictEntry] = []
    for entry in entries:
        entry.pinyin = normalize_pinyin(entry.pinyin, style=pinyin_style)
        entry.pinyin_normalized = normalize_pinyin_search(entry.pinyin)
        entry.tags = sorted({tag.strip() for tag in entry.tags if tag.strip()})
        entry.meanings = [meaning.strip() for meaning in entry.meanings if meaning.strip()]
        entry.examples = [example.strip() for example in entry.examples if example.strip()]
        if entry.hsk_level is None:
            entry.hsk_level = extract_hsk_level(entry.tags)
        if entry.pos is None:
            entry.pos = extract_pos(entry.tags)
        if entry.frequency is None:
            entry.frequency = extract_frequency(entry.tags)
        normalized.append(entry)
    return normalized


def dedupe_entries(entries: Iterable[DictEntry]) -> list[DictEntry]:
    merged: dict[tuple[str, str], DictEntry] = {}
    for entry in entries:
        key = (entry.simplified, entry.pinyin)
        if key not in merged:
            merged[key] = entry
            continue
        existing = merged[key]
        if not existing.traditional and entry.traditional:
            existing.traditional = entry.traditional
        existing.meanings = sorted(set(existing.meanings + entry.meanings))
        existing.examples = sorted(set(existing.examples + entry.examples))
        existing.tags = sorted(set(existing.tags + entry.tags))
        if existing.hsk_level is None and entry.hsk_level is not None:
            existing.hsk_level = entry.hsk_level
        if existing.pos is None and entry.pos:
            existing.pos = entry.pos
        if existing.frequency is None and entry.frequency is not None:
            existing.frequency = entry.frequency
    return list(merged.values())


def insert_dict_entries(db: Session, entries: Iterable[DictEntry], replace: bool = False) -> int:
    if replace:
        db.query(DictWord).delete()

    objects = [
        DictWord(
            simplified=entry.simplified,
            traditional=entry.traditional or None,
            pinyin=entry.pinyin,
            pinyin_normalized=entry.pinyin_normalized or None,
            meanings=json.dumps(entry.meanings, ensure_ascii=False),
            examples=json.dumps(entry.examples, ensure_ascii=False),
            tags=json.dumps(entry.tags, ensure_ascii=False),
            hsk_level=entry.hsk_level,
            pos=entry.pos,
            frequency=entry.frequency,
            last_modified=datetime.utcnow()
        )
        for entry in entries
    ]

    db.bulk_save_objects(objects)
    db.commit()
    return len(objects)


def run_import(
    db: Session,
    file_path: Path,
    file_type: str,
    mapping: Optional[CsvMapping],
    pinyin_style: str,
    dedupe: bool,
    replace: bool
) -> ImportStats:
    if file_type == "cedict":
        entries = parse_cedict_file(file_path)
    elif file_type == "csv":
        if not mapping:
            raise ValueError("CSV mapping required")
        entries = parse_csv_file(file_path, mapping)
    else:
        raise ValueError("Unsupported file type")

    normalized = normalize_entries(entries, pinyin_style)
    deduped = dedupe_entries(normalized) if dedupe else normalized
    inserted = insert_dict_entries(db, deduped, replace=replace)

    return ImportStats(
        parsed=len(entries),
        normalized=len(normalized),
        deduped=len(deduped),
        inserted=inserted
    )
