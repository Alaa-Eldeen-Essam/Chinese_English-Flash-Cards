from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Optional
from uuid import uuid4

from sqlalchemy.orm import Session

from ..db import SessionLocal
from ..models import ImportFile, ImportJob, ImportJobLog
from .importer import CsvMapping, run_import


def create_import_file(db: Session, path: Path, filename: str, size: int) -> ImportFile:
    file_id = uuid4().hex
    record = ImportFile(id=file_id, filename=filename, path=str(path), size=size)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def get_import_file(db: Session, file_id: str) -> Optional[ImportFile]:
    return db.query(ImportFile).filter(ImportFile.id == file_id).first()


def create_import_job(
    db: Session,
    file_id: str,
    file_type: str,
    mapping: Optional[CsvMapping],
    pinyin_style: str,
    dedupe: bool,
    replace: bool
) -> ImportJob:
    job_id = uuid4().hex
    mapping_json = json.dumps(mapping.__dict__, ensure_ascii=False) if mapping else None
    job = ImportJob(
        id=job_id,
        file_id=file_id,
        file_type=file_type,
        mapping_json=mapping_json,
        pinyin_style=pinyin_style,
        dedupe=dedupe,
        replace=replace,
        status="queued",
        progress=0
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    add_log(db, job.id, "Import job created")
    return job


def add_log(db: Session, job_id: str, message: str, level: str = "info") -> None:
    db.add(ImportJobLog(job_id=job_id, level=level, message=message))
    db.commit()


def update_job(
    db: Session,
    job: ImportJob,
    progress: Optional[int] = None,
    status: Optional[str] = None,
    stats: Optional[dict] = None,
    finished_at: Optional[datetime] = None
) -> ImportJob:
    if progress is not None:
        job.progress = max(0, min(100, progress))
    if status is not None:
        job.status = status
    if stats is not None:
        job.stats_json = json.dumps(stats, ensure_ascii=False)
    if finished_at is not None:
        job.finished_at = finished_at
    db.commit()
    db.refresh(job)
    return job


def run_job(job_id: str) -> None:
    db: Session = SessionLocal()
    try:
        job = db.query(ImportJob).filter(ImportJob.id == job_id).first()
        if not job:
            return

        update_job(db, job, progress=5, status="running")
        add_log(db, job.id, "Reading input file")

        file_record = db.query(ImportFile).filter(ImportFile.id == job.file_id).first()
        if not file_record:
            add_log(db, job.id, "Missing uploaded file", level="error")
            update_job(db, job, status="error", finished_at=datetime.utcnow())
            return

        mapping = None
        if job.mapping_json:
            mapping = CsvMapping(**json.loads(job.mapping_json))

        add_log(db, job.id, "Parsing entries")
        stats = run_import(
            db,
            file_path=Path(file_record.path),
            file_type=job.file_type,
            mapping=mapping,
            pinyin_style=job.pinyin_style,
            dedupe=job.dedupe,
            replace=job.replace
        )

        update_job(
            db,
            job,
            progress=90,
            status="running",
            stats={
                "parsed": stats.parsed,
                "normalized": stats.normalized,
                "deduped": stats.deduped,
                "inserted": stats.inserted
            }
        )
        add_log(db, job.id, f"Inserted {stats.inserted} rows")
        update_job(db, job, progress=100, status="done", finished_at=datetime.utcnow())
        add_log(db, job.id, "Import complete")
    except Exception as exc:
        if db:
            add_log(db, job_id, f"Import failed: {exc}", level="error")
            job = db.query(ImportJob).filter(ImportJob.id == job_id).first()
            if job:
                update_job(db, job, status="error", finished_at=datetime.utcnow())
    finally:
        db.close()


def get_import_job(db: Session, job_id: str) -> Optional[ImportJob]:
    return db.query(ImportJob).filter(ImportJob.id == job_id).first()


def get_import_logs(db: Session, job_id: str) -> list[ImportJobLog]:
    return (
        db.query(ImportJobLog)
        .filter(ImportJobLog.job_id == job_id)
        .order_by(ImportJobLog.timestamp.asc())
        .all()
    )
