import json
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import User
from ..schemas import (
    ImportJobResponse,
    ImportStatusResponse,
    ImportTriggerRequest,
    ImportUploadResponse
)
from ..services.import_jobs import (
    create_import_file,
    create_import_job,
    get_import_file,
    get_import_job,
    get_import_logs,
    run_job
)
from ..services.importer import CsvMapping
from .utils import get_current_user

router = APIRouter(prefix="/admin/import", tags=["admin-import"])


@router.post("/upload", response_model=ImportUploadResponse)
def upload_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> ImportUploadResponse:
    root_dir = Path(__file__).resolve().parents[3]
    raw_dir = root_dir / "data" / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)

    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")

    safe_name = file.filename.replace("..", "").replace("/", "_").replace("\\", "_")
    dest = raw_dir / safe_name
    content = file.file.read()
    dest.write_bytes(content)

    uploaded = create_import_file(db, dest, file.filename, size=len(content))
    return ImportUploadResponse(
        file_id=uploaded.id,
        filename=uploaded.filename,
        path=str(uploaded.path),
        size=uploaded.size
    )


@router.post("/trigger", response_model=ImportJobResponse)
def trigger_import(
    payload: ImportTriggerRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> ImportJobResponse:
    uploaded = get_import_file(db, payload.file_id)
    if not uploaded:
        raise HTTPException(status_code=404, detail="File not found")

    mapping = None
    if payload.file_type == "csv" and payload.csv_mapping:
        mapping = CsvMapping(**payload.csv_mapping)

    job = create_import_job(
        db,
        file_id=uploaded.id,
        file_type=payload.file_type,
        mapping=mapping,
        pinyin_style=payload.pinyin_style,
        dedupe=payload.dedupe,
        replace=payload.replace
    )

    background_tasks.add_task(run_job, job.id)
    return ImportJobResponse(job_id=job.id, status=job.status)


@router.get("/status/{job_id}", response_model=ImportStatusResponse)
def get_status(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> ImportStatusResponse:
    job = get_import_job(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    logs = get_import_logs(db, job_id)
    stats = json.loads(job.stats_json) if job.stats_json else None

    return ImportStatusResponse(
        job_id=job.id,
        status=job.status,
        progress=job.progress,
        logs=[{"timestamp": log.timestamp.isoformat(), "level": log.level, "message": log.message} for log in logs],
        stats=stats,
        created_at=job.created_at,
        finished_at=job.finished_at
    )
