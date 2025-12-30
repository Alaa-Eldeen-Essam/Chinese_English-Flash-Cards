import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..crud import update_user_settings
from ..datasets import DATASET_CATALOG, DATASET_MAP
from ..db import get_db
from ..models import DictWord, User
from ..schemas import (
    DatasetInfo,
    DatasetPackResponse,
    DatasetSelectionRequest,
    DatasetSelectionResponse,
    DictWordOut
)
from .utils import get_current_user

router = APIRouter(prefix="/datasets", tags=["datasets"])

MAX_PACK_LIMIT = 1000


def _load_list(value: str | None) -> list[str]:
    if not value:
        return []
    try:
        data = json.loads(value)
        if isinstance(data, list):
            return [str(item) for item in data]
    except json.JSONDecodeError:
        pass
    return [value]


def _dict_word_out(word: DictWord) -> DictWordOut:
    return DictWordOut(
        id=word.id,
        simplified=word.simplified,
        traditional=word.traditional,
        pinyin=word.pinyin,
        pinyin_normalized=word.pinyin_normalized,
        meanings=_load_list(word.meanings),
        examples=_load_list(word.examples),
        tags=_load_list(word.tags),
        hsk_level=word.hsk_level,
        pos=word.pos,
        frequency=word.frequency
    )


def _get_settings(user: User) -> dict:
    try:
        return json.loads(user.settings_json or "{}")
    except json.JSONDecodeError:
        return {}


@router.get("/catalog", response_model=list[DatasetInfo])
def get_catalog() -> list[DatasetInfo]:
    return [DatasetInfo(**dataset.__dict__) for dataset in DATASET_CATALOG]


@router.get("/selection", response_model=DatasetSelectionResponse)
def get_selection(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> DatasetSelectionResponse:
    settings = _get_settings(current_user)
    datasets = settings.get("datasets", {})
    selected = datasets.get("selected", [])
    updated_at = datasets.get("updated_at") or datetime.utcnow().isoformat()
    return DatasetSelectionResponse(selected=selected, updated_at=updated_at)


@router.post("/selection", response_model=DatasetSelectionResponse)
def update_selection(
    payload: DatasetSelectionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> DatasetSelectionResponse:
    settings = _get_settings(current_user)
    allowed = set(DATASET_MAP.keys())
    selected = [item for item in payload.selected if item in allowed]
    datasets = {
        "selected": selected,
        "updated_at": datetime.utcnow().isoformat()
    }
    settings["datasets"] = datasets
    update_user_settings(db, current_user, settings)
    return DatasetSelectionResponse(selected=selected, updated_at=datasets["updated_at"])


@router.get("/pack", response_model=DatasetPackResponse)
def get_pack(
    dataset_id: str,
    offset: int = 0,
    limit: int = 500,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> DatasetPackResponse:
    dataset = DATASET_MAP.get(dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    if dataset.status != "available":
        raise HTTPException(status_code=400, detail="Dataset not available for download")

    offset = max(0, offset)
    limit = max(1, min(limit, MAX_PACK_LIMIT))

    query = db.query(DictWord)
    filters = dataset.filters or {}
    hsk_levels = filters.get("hsk_levels")
    if isinstance(hsk_levels, list) and hsk_levels:
        query = query.filter(DictWord.hsk_level.in_(hsk_levels))

    total = query.count()
    rows = query.order_by(DictWord.id.asc()).offset(offset).limit(limit).all()

    return DatasetPackResponse(
        dataset_id=dataset_id,
        total=total,
        offset=offset,
        limit=limit,
        items=[_dict_word_out(word) for word in rows]
    )
