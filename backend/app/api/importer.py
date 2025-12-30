from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ..db import get_db
from ..schemas import (
    ImportJobResponse,
    ImportStatusResponse,
    ImportTriggerRequest,
    ImportUploadResponse
)
from ..services.import_jobs import create_job, get_file, get_job, register_file, run_job
from ..services.importer import CsvMapping

router = APIRouter(prefix="/admin/import", tags=["admin-import"])


@router.post("/upload", response_model=ImportUploadResponse)
def upload_file(file: UploadFile = File(...), db: Session = Depends(get_db)) -> ImportUploadResponse:
    _ = db
    root_dir = Path(__file__).resolve().parents[3]
    raw_dir = root_dir / "data" / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)

    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")

    safe_name = file.filename.replace("..", "").replace("/", "_").replace("\\", "_")
    dest = raw_dir / safe_name
    content = file.file.read()
    dest.write_bytes(content)

    uploaded = register_file(dest, file.filename, size=len(content))
    return ImportUploadResponse(
        file_id=uploaded.id,
        filename=uploaded.filename,
        path=str(uploaded.path),
        size=uploaded.size
    )


@router.post("/trigger", response_model=ImportJobResponse)
def trigger_import(
    payload: ImportTriggerRequest,
    background_tasks: BackgroundTasks
) -> ImportJobResponse:
    uploaded = get_file(payload.file_id)
    if not uploaded:
        raise HTTPException(status_code=404, detail="File not found")

    mapping = None
    if payload.file_type == "csv" and payload.csv_mapping:
        mapping = CsvMapping(**payload.csv_mapping)

    job = create_job(
        file_path=uploaded.path,
        file_type=payload.file_type,
        mapping=mapping,
        pinyin_style=payload.pinyin_style,
        dedupe=payload.dedupe,
        replace=payload.replace
    )

    background_tasks.add_task(run_job, job.id)
    return ImportJobResponse(job_id=job.id, status=job.status)


@router.get("/status/{job_id}", response_model=ImportStatusResponse)
def get_status(job_id: str) -> ImportStatusResponse:
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    stats = None
    if job.stats:
        stats = {
            "parsed": job.stats.parsed,
            "normalized": job.stats.normalized,
            "deduped": job.stats.deduped,
            "inserted": job.stats.inserted
        }

    return ImportStatusResponse(
        job_id=job.id,
        status=job.status,
        progress=job.progress,
        logs=job.logs,
        stats=stats,
        created_at=job.created_at,
        finished_at=job.finished_at
    )
