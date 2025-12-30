from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..crud import dump_user_data
from ..db import get_db
from ..schemas import DumpResponse, HealthResponse, SyncRequest, SyncResponse
from .utils import resolve_user_id

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    return HealthResponse(status="ok")


@router.get("/dump", response_model=DumpResponse)
def dump_user(user_id: str = "me", db: Session = Depends(get_db)) -> DumpResponse:
    owner_id = resolve_user_id(db, user_id)
    payload = dump_user_data(db, owner_id)
    return DumpResponse(**payload)


@router.post("/sync", response_model=SyncResponse)
def sync_user(payload: SyncRequest, db: Session = Depends(get_db)) -> SyncResponse:
    _ = resolve_user_id(db, payload.user_id)
    # TODO: Apply changes to the database with conflict resolution.
    received = {
        "cards": len(payload.cards),
        "collections": len(payload.collections),
        "study_logs": len(payload.study_logs)
    }
    return SyncResponse(status="accepted", received=received)
