from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..crud import _dump_list, dump_user_data
from ..db import get_db
from ..models import Card, Collection, StudyLog
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
    owner_id = resolve_user_id(db, payload.user_id)
    now = datetime.utcnow()
    id_map: dict = {"collections": {}, "cards": {}}
    received = {"cards": 0, "collections": 0, "study_logs": 0}

    for incoming in payload.collections:
        if incoming.id <= 0:
            collection = Collection(
                owner_id=owner_id,
                name=incoming.name,
                description=incoming.description,
                updated_at=now,
                last_modified=now
            )
            db.add(collection)
            db.commit()
            db.refresh(collection)
            id_map["collections"][str(incoming.id)] = collection.id
            received["collections"] += 1
            continue

        existing = db.query(Collection).filter(
            Collection.owner_id == owner_id,
            Collection.id == incoming.id
        ).first()
        if not existing:
            collection = Collection(
                id=incoming.id,
                owner_id=owner_id,
                name=incoming.name,
                description=incoming.description,
                updated_at=now,
                last_modified=now
            )
            db.add(collection)
            received["collections"] += 1
            continue
        if incoming.last_modified > (existing.last_modified or existing.updated_at):
            existing.name = incoming.name
            existing.description = incoming.description
            existing.updated_at = now
            existing.last_modified = now
            received["collections"] += 1

    db.commit()

    for incoming in payload.cards:
        mapped_collection_ids = [
            id_map["collections"].get(str(cid), cid) for cid in incoming.collection_ids
        ]
        if incoming.id <= 0:
            card = Card(
                owner_id=owner_id,
                simplified=incoming.simplified,
                pinyin=incoming.pinyin,
                meanings_json=_dump_list(incoming.meanings),
                examples_json=_dump_list(incoming.examples),
                tags_json=_dump_list(incoming.tags),
                created_from_dict_id=incoming.created_from_dict_id,
                easiness=incoming.easiness,
                interval_days=incoming.interval_days,
                repetitions=incoming.repetitions,
                next_due=incoming.next_due,
                updated_at=now,
                last_modified=now
            )
            collections = []
            if mapped_collection_ids:
                collections = db.query(Collection).filter(
                    Collection.owner_id == owner_id,
                    Collection.id.in_(mapped_collection_ids)
                ).all()
            card.collections = collections
            db.add(card)
            db.commit()
            db.refresh(card)
            id_map["cards"][str(incoming.id)] = card.id
            received["cards"] += 1
            continue

        existing = db.query(Card).filter(Card.owner_id == owner_id, Card.id == incoming.id).first()
        if not existing:
            card = Card(
                id=incoming.id,
                owner_id=owner_id,
                simplified=incoming.simplified,
                pinyin=incoming.pinyin,
                meanings_json=_dump_list(incoming.meanings),
                examples_json=_dump_list(incoming.examples),
                tags_json=_dump_list(incoming.tags),
                created_from_dict_id=incoming.created_from_dict_id,
                easiness=incoming.easiness,
                interval_days=incoming.interval_days,
                repetitions=incoming.repetitions,
                next_due=incoming.next_due,
                updated_at=now,
                last_modified=now
            )
            collections = []
            if mapped_collection_ids:
                collections = db.query(Collection).filter(
                    Collection.owner_id == owner_id,
                    Collection.id.in_(mapped_collection_ids)
                ).all()
            card.collections = collections
            db.add(card)
            received["cards"] += 1
            continue
        if incoming.last_modified > (existing.last_modified or existing.updated_at):
            existing.simplified = incoming.simplified
            existing.pinyin = incoming.pinyin
            existing.meanings_json = _dump_list(incoming.meanings)
            existing.examples_json = _dump_list(incoming.examples)
            existing.tags_json = _dump_list(incoming.tags)
            existing.created_from_dict_id = incoming.created_from_dict_id
            existing.easiness = incoming.easiness
            existing.interval_days = incoming.interval_days
            existing.repetitions = incoming.repetitions
            existing.next_due = incoming.next_due
            existing.updated_at = now
            existing.last_modified = now
            collections = []
            if mapped_collection_ids:
                collections = db.query(Collection).filter(
                    Collection.owner_id == owner_id,
                    Collection.id.in_(mapped_collection_ids)
                ).all()
            existing.collections = collections
            received["cards"] += 1

    db.commit()

    for incoming in payload.study_logs:
        incoming_card_id = id_map["cards"].get(str(incoming.card_id), incoming.card_id)
        existing = db.query(StudyLog).filter(
            StudyLog.user_id == owner_id,
            StudyLog.id == incoming.id
        ).first()
        if existing:
            continue
        log = StudyLog(
            id=None if incoming.id <= 0 else incoming.id,
            card_id=incoming_card_id,
            user_id=owner_id,
            timestamp=incoming.timestamp,
            ease=incoming.ease,
            correct=incoming.correct,
            response_time_ms=incoming.response_time_ms,
            last_modified=now
        )
        db.add(log)
        received["study_logs"] += 1

    db.commit()
    return SyncResponse(status="accepted", received=received, id_map=id_map)
