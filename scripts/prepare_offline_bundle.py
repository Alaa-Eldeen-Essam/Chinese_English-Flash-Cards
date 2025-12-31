#!/usr/bin/env python3
"""
Prepare an offline bundle with built frontend, backend binary, and baseline DB.

Expected inputs (build first):
  - frontend/dist (Vite build)
  - dist/sc-flashcards-backend(.exe) (PyInstaller output)
  - backend/data/flashcards.db (baseline dataset)
"""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path


def repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def copy_dir(src: Path, dest: Path) -> None:
    if not src.exists():
        raise FileNotFoundError(f"Missing directory: {src}")
    shutil.copytree(src, dest, dirs_exist_ok=True)


def copy_file(src: Path, dest: Path) -> None:
    if not src.exists():
        raise FileNotFoundError(f"Missing file: {src}")
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dest)


def parse_args() -> argparse.Namespace:
    root = repo_root()
    binary_name = "sc-flashcards-backend.exe" if sys.platform.startswith("win") else "sc-flashcards-backend"
    parser = argparse.ArgumentParser(description="Prepare offline distribution bundle")
    parser.add_argument("--frontend-dist", type=Path, default=root / "frontend" / "dist")
    parser.add_argument("--backend-binary", type=Path, default=root / "dist" / binary_name)
    parser.add_argument("--db-path", type=Path, default=root / "backend" / "data" / "flashcards.db")
    parser.add_argument("--output-dir", type=Path, default=root / "dist" / "offline-bundle")
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    try:
        copy_dir(args.frontend_dist, args.output_dir / "frontend" / "dist")
    except FileNotFoundError as exc:
        print(exc)
        print("Build the frontend first: cd frontend && npm run build")
        return 1

    try:
        copy_file(args.backend_binary, args.output_dir / "backend" / args.backend_binary.name)
    except FileNotFoundError as exc:
        print(exc)
        print("Build the backend binary first: pyinstaller -F -n sc-flashcards-backend backend/app/main.py")
        return 1

    try:
        copy_file(args.db_path, args.output_dir / "backend" / "data" / args.db_path.name)
    except FileNotFoundError as exc:
        print(exc)
        print("Create the baseline database first: python scripts/import_dict.py --download --replace")
        return 1

    print(f"Offline bundle ready at: {args.output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
