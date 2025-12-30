from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
from uuid import uuid4

from sqlalchemy.orm import Session

from ..db import SessionLocal
from .importer import CsvMapping, ImportStats, run_import


@dataclass
class ImportJob:
    id: str
    file_path: Path
    file_type: str
    mapping: Optional[CsvMapping]
    pinyin_style: str
    dedupe: bool
    replace: bool
    status: str = "queued"
    progress: int = 0
    logs: List[dict] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.utcnow)
    finished_at: Optional[datetime] = None
    stats: Optional[ImportStats] = None


@dataclass
class UploadedFile:
    id: str
    path: Path
    filename: str
    size: int


FILES: Dict[str, UploadedFile] = {}
JOBS: Dict[str, ImportJob] = {}


def register_file(path: Path, filename: str, size: int) -> UploadedFile:
    file_id = uuid4().hex
    uploaded = UploadedFile(id=file_id, path=path, filename=filename, size=size)
    FILES[file_id] = uploaded
    return uploaded


def get_file(file_id: str) -> Optional[UploadedFile]:
    return FILES.get(file_id)


def create_job(
    file_path: Path,
    file_type: str,
    mapping: Optional[CsvMapping],
    pinyin_style: str,
    dedupe: bool,
    replace: bool
) -> ImportJob:
    job_id = uuid4().hex
    job = ImportJob(
        id=job_id,
        file_path=file_path,
        file_type=file_type,
        mapping=mapping,
        pinyin_style=pinyin_style,
        dedupe=dedupe,
        replace=replace
    )
    JOBS[job_id] = job
    log(job, "Import job created")
    return job


def get_job(job_id: str) -> Optional[ImportJob]:
    return JOBS.get(job_id)


def log(job: ImportJob, message: str, level: str = "info") -> None:
    job.logs.append({"timestamp": datetime.utcnow().isoformat(), "level": level, "message": message})


def update_progress(job: ImportJob, progress: int, message: Optional[str] = None) -> None:
    job.progress = max(0, min(100, progress))
    if message:
        log(job, message)


def run_job(job_id: str) -> None:
    job = JOBS.get(job_id)
    if not job:
        return

    job.status = "running"
    update_progress(job, 5, "Reading input file")

    db: Session = SessionLocal()
    try:
        update_progress(job, 25, "Parsing entries")
        stats = run_import(
            db,
            file_path=job.file_path,
            file_type=job.file_type,
            mapping=job.mapping,
            pinyin_style=job.pinyin_style,
            dedupe=job.dedupe,
            replace=job.replace
        )
        job.stats = stats
        update_progress(job, 90, f"Inserted {stats.inserted} rows")
        job.status = "done"
        update_progress(job, 100, "Import complete")
    except Exception as exc:
        job.status = "error"
        log(job, f"Import failed: {exc}", level="error")
    finally:
        job.finished_at = datetime.utcnow()
        db.close()
