#!/usr/bin/env python3
"""
Import CC-CEDICT and HSK lists into SQLite, with a JSON export for review.

Usage examples:
  python scripts/import_dict.py --download
  python scripts/import_dict.py --cedict data/raw/cedict.u8 --hsk data/raw/hsk1.csv data/raw/hsk2.csv
  python scripts/import_dict.py --skip-json
"""

from __future__ import annotations

import argparse
import csv
import gzip
import json
import re
import sqlite3
import urllib.request
from pathlib import Path
from typing import Iterable, Iterator, Optional

CEDICT_PATTERN = re.compile(
    r"^(?P<trad>\S+)\s+(?P<simp>\S+)\s+\[(?P<pinyin>[^\]]+)\]\s+/(?P<defs>.+)/$"
)

DEFAULT_CEDICT_URL = (
    "https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz"
)

WORD_KEYS = ["simplified", "hanzi", "word", "chinese", "characters"]
LEVEL_KEYS = ["level", "hsk", "hsk_level"]
DEFINITION_KEYS = ["definitions", "definition", "english", "meaning"]


def repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def ensure_dirs(data_dir: Path, raw_dir: Path) -> None:
    data_dir.mkdir(parents=True, exist_ok=True)
    raw_dir.mkdir(parents=True, exist_ok=True)


def download_file(url: str, dest: Path) -> None:
    print(f"Downloading {url} -> {dest}")
    dest.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(url) as response, open(dest, "wb") as f:
        f.write(response.read())


def open_text(path: Path) -> Iterator[str]:
    if path.suffix == ".gz":
        with gzip.open(path, "rt", encoding="utf-8") as f:
            for line in f:
                yield line
    else:
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                yield line


def parse_cedict_text(path: Path) -> list[dict]:
    entries: list[dict] = []
    skipped = 0
    for line in open_text(path):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        match = CEDICT_PATTERN.match(line)
        if not match:
            skipped += 1
            continue
        defs_raw = match.group("defs")
        defs = [d for d in defs_raw.split("/") if d]
        entries.append(
            {
                "word_id": 0,
                "simplified": match.group("simp"),
                "traditional": match.group("trad"),
                "pinyin": match.group("pinyin"),
                "pinyin_normalized": normalize_pinyin_search(match.group("pinyin")),
                "english_defs": defs,
                "examples": [],
                "tags": [],
                "hsk_level": None,
                "pos": None,
                "frequency": None
            }
        )
    print(f"Parsed {len(entries)} entries from CC-CEDICT, skipped {skipped} lines")
    return entries


def parse_cedict_json(path: Path) -> list[dict]:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    entries: list[dict] = []
    if isinstance(data, dict):
        data = data.get("entries", [])

    if not isinstance(data, list):
        return entries

    for item in data:
        if not isinstance(item, dict):
            continue
        simplified = item.get("simplified") or item.get("word")
        traditional = item.get("traditional")
        pinyin = item.get("pinyin")
        defs = None
        for key in DEFINITION_KEYS:
            defs = item.get(key)
            if defs:
                break
        if simplified and pinyin and defs:
            if isinstance(defs, str):
                defs_list = [d for d in defs.split("/") if d]
            elif isinstance(defs, list):
                defs_list = [str(d) for d in defs if d]
            else:
                defs_list = []
            entries.append(
                {
                    "word_id": 0,
                    "simplified": simplified,
                    "traditional": traditional,
                    "pinyin": pinyin,
                    "pinyin_normalized": normalize_pinyin_search(pinyin),
                    "english_defs": defs_list,
                    "examples": [],
                    "tags": [],
                    "hsk_level": None,
                    "pos": None,
                    "frequency": None
                }
            )
    print(f"Parsed {len(entries)} entries from JSON CC-CEDICT")
    return entries


def parse_cedict(path: Path) -> list[dict]:
    if path.suffix.lower() == ".json":
        return parse_cedict_json(path)
    return parse_cedict_text(path)


def infer_level_from_name(path: Path) -> str | None:
    match = re.search(r"hsk\s*([1-6])", path.stem, re.IGNORECASE)
    if match:
        return match.group(1)
    return None


def resolve_word(row: dict) -> str | None:
    for key in WORD_KEYS:
        value = row.get(key)
        if value:
            return str(value).strip()
    return None


def resolve_level(row: dict, default_level: str | None) -> str | None:
    for key in LEVEL_KEYS:
        value = row.get(key)
        if value:
            return str(value).strip()
    return default_level


def load_hsk_csv(path: Path, default_level: str | None) -> dict[str, set[str]]:
    tags: dict[str, set[str]] = {}
    with open(path, "r", encoding="utf-8") as f:
        sample = f.read(2048)
        f.seek(0)
        try:
            dialect = csv.Sniffer().sniff(sample)
        except csv.Error:
            dialect = csv.excel
        reader = csv.DictReader(f, dialect=dialect)
        if not reader.fieldnames:
            return tags
        for row in reader:
            word = resolve_word(row)
            level = resolve_level(row, default_level)
            if not word or not level:
                continue
            tag = f"HSK{level}"
            tags.setdefault(word, set()).add(tag)
    return tags


def load_hsk_json(path: Path, default_level: str | None) -> dict[str, set[str]]:
    tags: dict[str, set[str]] = {}
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if isinstance(data, dict):
        data = data.get("entries", data.get("data", []))

    if not isinstance(data, list):
        return tags

    for item in data:
        if isinstance(item, str):
            word = item.strip()
            level = default_level
        elif isinstance(item, dict):
            word = resolve_word(item)
            level = resolve_level(item, default_level)
        else:
            continue
        if not word or not level:
            continue
        tag = f"HSK{level}"
        tags.setdefault(word, set()).add(tag)
    return tags


def load_hsk_tags(paths: Iterable[Path]) -> dict[str, set[str]]:
    merged: dict[str, set[str]] = {}
    for path in paths:
        default_level = infer_level_from_name(path)
        if path.suffix.lower() == ".json":
            local = load_hsk_json(path, default_level)
        else:
            local = load_hsk_csv(path, default_level)
        for word, tags in local.items():
            merged.setdefault(word, set()).update(tags)
    print(f"Loaded HSK tags for {len(merged)} words")
    return merged


def normalize_pinyin_search(pinyin: str) -> str:
    if not pinyin:
        return ""
    normalized = pinyin.lower()
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


def apply_tags(entries: list[dict], hsk_tags: dict[str, set[str]]) -> None:
    by_simplified: dict[str, list[dict]] = {}
    for entry in entries:
        by_simplified.setdefault(entry["simplified"], []).append(entry)

    created = 0
    for word, tags in hsk_tags.items():
        if word in by_simplified:
            for entry in by_simplified[word]:
                entry["tags"].extend(sorted(tags))
        else:
            entries.append(
                {
                    "word_id": 0,
                    "simplified": word,
                    "traditional": None,
                    "pinyin": "",
                    "pinyin_normalized": "",
                    "english_defs": [],
                    "examples": [],
                    "tags": sorted(tags),
                    "hsk_level": extract_hsk_level(tags),
                    "pos": extract_pos(tags),
                    "frequency": extract_frequency(tags)
                }
            )
            created += 1
    if created:
        print(f"Added {created} HSK-only entries")

    for entry in entries:
        if entry["tags"]:
            entry["tags"] = sorted(set(entry["tags"]))
        if entry.get("hsk_level") is None:
            entry["hsk_level"] = extract_hsk_level(entry.get("tags", []))
        if entry.get("pos") is None:
            entry["pos"] = extract_pos(entry.get("tags", []))
        if entry.get("frequency") is None:
            entry["frequency"] = extract_frequency(entry.get("tags", []))


def assign_ids(entries: list[dict]) -> None:
    for idx, entry in enumerate(entries, start=1):
        entry["word_id"] = idx


def write_json(entries: list[dict], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(entries, f, ensure_ascii=False, indent=2)
    print(f"Wrote JSON export: {output_path}")


def init_db(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS dict_word (
          id INTEGER PRIMARY KEY,
          simplified TEXT NOT NULL,
          traditional TEXT,
          pinyin TEXT,
          pinyin_normalized TEXT,
          meanings TEXT,
          examples TEXT,
          tags TEXT,
          hsk_level INTEGER,
          pos TEXT,
          frequency REAL
        );
        """
    )


def insert_into_db(entries: list[dict], db_path: Path, replace: bool) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    try:
        init_db(conn)
        if replace:
            conn.execute("DELETE FROM dict_word")
            rows = [
                (
                    entry["word_id"],
                    entry["simplified"],
                    entry["traditional"],
                    entry["pinyin"],
                    entry.get("pinyin_normalized"),
                    json.dumps(entry["english_defs"], ensure_ascii=False),
                    json.dumps(entry["examples"], ensure_ascii=False),
                    json.dumps(entry["tags"], ensure_ascii=False),
                    entry.get("hsk_level"),
                    entry.get("pos"),
                    entry.get("frequency")
                )
                for entry in entries
            ]
            conn.executemany(
                """
                INSERT INTO dict_word (
                  id, simplified, traditional, pinyin, pinyin_normalized, meanings, examples, tags,
                  hsk_level, pos, frequency
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                rows
            )
        else:
            rows = [
                (
                    entry["simplified"],
                    entry["traditional"],
                    entry["pinyin"],
                    entry.get("pinyin_normalized"),
                    json.dumps(entry["english_defs"], ensure_ascii=False),
                    json.dumps(entry["examples"], ensure_ascii=False),
                    json.dumps(entry["tags"], ensure_ascii=False),
                    entry.get("hsk_level"),
                    entry.get("pos"),
                    entry.get("frequency")
                )
                for entry in entries
            ]
            conn.executemany(
                """
                INSERT INTO dict_word (
                  simplified, traditional, pinyin, pinyin_normalized, meanings, examples, tags,
                  hsk_level, pos, frequency
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                rows
            )
        conn.commit()
        print(f"Inserted {len(entries)} rows into {db_path}")
    finally:
        conn.close()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import CC-CEDICT + HSK into SQLite")
    parser.add_argument("--cedict", type=Path, default=None, help="Path to CC-CEDICT file")
    parser.add_argument(
        "--hsk",
        type=Path,
        nargs="*",
        default=[],
        help="Paths to HSK CSV/JSON files (level inferred from filename or column)"
    )
    parser.add_argument(
        "--output-json",
        type=Path,
        default=repo_root() / "data" / "cedict_import.json",
        help="JSON output path"
    )
    parser.add_argument(
        "--db-path",
        type=Path,
        default=repo_root() / "backend" / "data" / "flashcards.db",
        help="SQLite DB path"
    )
    parser.add_argument(
        "--download",
        action="store_true",
        help="Download CC-CEDICT into data/raw/"
    )
    parser.add_argument(
        "--replace",
        action="store_true",
        help="Replace existing dict_word rows before inserting"
    )
    parser.add_argument("--skip-json", action="store_true", help="Skip JSON export")
    parser.add_argument("--skip-sqlite", action="store_true", help="Skip SQLite insert")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = repo_root()
    data_dir = root / "data"
    raw_dir = data_dir / "raw"
    ensure_dirs(data_dir, raw_dir)

    if args.download:
        cedict_dest = raw_dir / "cedict.u8.gz"
        if not cedict_dest.exists():
            download_file(DEFAULT_CEDICT_URL, cedict_dest)
        else:
            print(f"Found existing CC-CEDICT file at {cedict_dest}")
    else:
        cedict_dest = None

    cedict_path = args.cedict
    if not cedict_path:
        cedict_path = cedict_dest or raw_dir / "cedict.u8.gz"

    if not cedict_path.exists():
        print(f"CC-CEDICT file not found: {cedict_path}")
        print("Use --download or provide --cedict path")
        return 1

    entries = parse_cedict(cedict_path)
    if not entries:
        print("No entries parsed from CC-CEDICT")
        return 1

    hsk_tags = load_hsk_tags(args.hsk)
    if hsk_tags:
        apply_tags(entries, hsk_tags)

    assign_ids(entries)

    if not args.skip_json:
        write_json(entries, args.output_json)

    if not args.skip_sqlite:
        insert_into_db(entries, args.db_path, args.replace)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
