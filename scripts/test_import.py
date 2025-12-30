#!/usr/bin/env python3
"""Quick check: sample 10 random entries from dict_word."""

from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Sample 10 dictionary rows")
    parser.add_argument(
        "--db-path",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "backend" / "data" / "flashcards.db",
        help="SQLite DB path"
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if not args.db_path.exists():
        print(f"Database not found: {args.db_path}")
        return 1

    conn = sqlite3.connect(args.db_path)
    try:
        cursor = conn.execute(
            "SELECT simplified, pinyin, meanings FROM dict_word ORDER BY RANDOM() LIMIT 10"
        )
        rows = cursor.fetchall()
    except sqlite3.Error as exc:
        print(f"Query failed: {exc}")
        return 1
    finally:
        conn.close()

    if not rows:
        print("No rows found in dict_word")
        return 1

    for simplified, pinyin, meanings in rows:
        try:
            meanings_list = json.loads(meanings) if meanings else []
        except json.JSONDecodeError:
            meanings_list = [meanings] if meanings else []
        first_meanings = "; ".join(meanings_list[:2])
        print(f"{simplified} [{pinyin}] - {first_meanings}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
