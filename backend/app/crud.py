from __future__ import annotations

import json
from datetime import datetime
from typing import Iterable, List, Optional

from sqlalchemy.orm import Session

from .models import Card, Collection, RefreshToken, StudyLog, User, card_collection
from .srs import apply_sm2


def _dump_list(value: Optional[Iterable[str]]) -> str:
    return json.dumps(list(value or []), ensure_ascii=False)


def _load_list(value: Optional[str]) -> List[str]:
    if not value:
        return []
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return [value]


def get_user(db: Session, user_id: int) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()


def get_user_by_username(db: Session, username: str) -> Optional[User]:
    return db.query(User).filter(User.username == username).first()


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email).first()


def create_user(
    db: Session,
    username: str,
    hashed_password: str,
    email: Optional[str] = None,
    auth_provider: str = "password",
    oauth_subject: Optional[str] = None
) -> User:
    now = datetime.utcnow()
    user = User(
        username=username,
        email=email,
        hashed_password=hashed_password,
        auth_provider=auth_provider,
        oauth_subject=oauth_subject,
        settings_json="{}",
        created_at=now,
        updated_at=now,
        last_modified=now
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update_user_settings(db: Session, user: User, settings: dict) -> User:
    now = datetime.utcnow()
    user.settings_json = json.dumps(settings or {}, ensure_ascii=False)
    user.updated_at = now
    user.last_modified = now
    db.commit()
    db.refresh(user)
    return user


def store_refresh_token(
    db: Session,
    user_id: int,
    token_hash: str,
    expires_at: datetime
) -> RefreshToken:
    token = RefreshToken(
        user_id=user_id,
        token_hash=token_hash,
        expires_at=expires_at
    )
    db.add(token)
    db.commit()
    db.refresh(token)
    return token


def get_refresh_token(db: Session, token_hash: str) -> Optional[RefreshToken]:
    return db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).first()


def revoke_refresh_token(db: Session, token: RefreshToken) -> RefreshToken:
    token.revoked_at = datetime.utcnow()
    db.commit()
    db.refresh(token)
    return token


def list_collections(db: Session, owner_id: int) -> List[Collection]:
    return db.query(Collection).filter(Collection.owner_id == owner_id).all()


def create_collection(db: Session, owner_id: int, name: str, description: str) -> Collection:
    now = datetime.utcnow()
    collection = Collection(
        owner_id=owner_id,
        name=name,
        description=description,
        updated_at=now,
        last_modified=now
    )
    db.add(collection)
    db.commit()
    db.refresh(collection)
    return collection


def update_collection(
    db: Session,
    collection: Collection,
    name: Optional[str],
    description: Optional[str]
) -> Collection:
    now = datetime.utcnow()
    if name is not None:
        collection.name = name
    if description is not None:
        collection.description = description
    collection.updated_at = now
    collection.last_modified = now
    db.commit()
    db.refresh(collection)
    return collection


def delete_collection(db: Session, collection: Collection) -> None:
    collection.cards = []
    db.commit()
    db.refresh(collection)
    db.delete(collection)
    db.commit()
    db.commit()


def create_card(
    db: Session,
    owner_id: int,
    simplified: str,
    pinyin: str,
    meanings: Iterable[str],
    examples: Iterable[str],
    tags: Iterable[str],
    created_from_dict_id: Optional[int],
    collection_ids: Iterable[int]
) -> Card:
    now = datetime.utcnow()
    card = Card(
        owner_id=owner_id,
        simplified=simplified,
        pinyin=pinyin,
        meanings_json=_dump_list(meanings),
        examples_json=_dump_list(examples),
        tags_json=_dump_list(tags),
        created_from_dict_id=created_from_dict_id,
        next_due=now,
        updated_at=now,
        last_modified=now
    )
    db.add(card)
    db.commit()
    db.refresh(card)

    if collection_ids:
        collections = (
            db.query(Collection)
            .filter(Collection.owner_id == owner_id)
            .filter(Collection.id.in_(list(collection_ids)))
            .all()
        )
        for collection in collections:
            collection.cards.append(card)
        db.commit()
        db.refresh(card)

    return card


def update_card(
    db: Session,
    card: Card,
    simplified: Optional[str] = None,
    pinyin: Optional[str] = None,
    meanings: Optional[Iterable[str]] = None,
    examples: Optional[Iterable[str]] = None,
    tags: Optional[Iterable[str]] = None,
    collection_ids: Optional[Iterable[int]] = None
) -> Card:
    now = datetime.utcnow()
    if simplified is not None:
        card.simplified = simplified
    if pinyin is not None:
        card.pinyin = pinyin
    if meanings is not None:
        card.meanings_json = _dump_list(meanings)
    if examples is not None:
        card.examples_json = _dump_list(examples)
    if tags is not None:
        card.tags_json = _dump_list(tags)

    if collection_ids is not None:
        collections = (
            db.query(Collection)
            .filter(Collection.owner_id == card.owner_id)
            .filter(Collection.id.in_(list(collection_ids)))
            .all()
        )
        card.collections = collections

    card.updated_at = now
    card.last_modified = now
    db.commit()
    db.refresh(card)
    return card


def delete_card(db: Session, card: Card) -> None:
    db.query(StudyLog).filter(StudyLog.card_id == card.id).delete()
    card.collections = []
    db.commit()
    db.refresh(card)
    db.delete(card)
    db.commit()


def list_cards(
    db: Session,
    owner_id: int,
    collection_id: Optional[int] = None,
    query: Optional[str] = None
) -> List[Card]:
    q = db.query(Card).filter(Card.owner_id == owner_id)
    if collection_id is not None:
        q = q.join(card_collection).filter(card_collection.c.collection_id == collection_id)
    if query:
        like_query = f"%{query}%"
        q = q.filter(Card.simplified.like(like_query) | Card.pinyin.like(like_query))
    return q.order_by(Card.next_due.asc()).all()


def record_study(
    db: Session,
    user_id: int,
    card_id: int,
    quality: int,
    response_time_ms: int
) -> tuple[Card, StudyLog]:
    card = db.query(Card).filter(Card.owner_id == user_id, Card.id == card_id).first()
    if not card:
        raise ValueError("Card not found")

    apply_sm2(card, quality)
    log = StudyLog(
        card_id=card.id,
        user_id=user_id,
        ease=quality,
        correct=quality >= 3,
        response_time_ms=response_time_ms,
        last_modified=datetime.utcnow()
    )
    db.add(log)
    db.commit()
    db.refresh(card)
    db.refresh(log)
    return card, log


def card_to_dict(card: Card) -> dict:
    return {
        "id": card.id,
        "owner_id": card.owner_id,
        "simplified": card.simplified,
        "pinyin": card.pinyin,
        "meanings": _load_list(card.meanings_json),
        "examples": _load_list(card.examples_json),
        "tags": _load_list(card.tags_json),
        "created_from_dict_id": card.created_from_dict_id,
        "easiness": card.easiness,
        "interval_days": card.interval_days,
        "repetitions": card.repetitions,
        "next_due": card.next_due,
        "collection_ids": [collection.id for collection in card.collections],
        "last_modified": card.last_modified
    }


def dump_user_data(db: Session, user_id: int) -> dict:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ValueError("User not found")

    collections = list_collections(db, user_id)
    cards = list_cards(db, user_id)
    study_logs = db.query(StudyLog).filter(StudyLog.user_id == user_id).all()

    last_modified = user.last_modified
    for collection in collections:
        if collection.last_modified and collection.last_modified > last_modified:
            last_modified = collection.last_modified
    for card in cards:
        if card.last_modified and card.last_modified > last_modified:
            last_modified = card.last_modified
    for log in study_logs:
        if log.last_modified and log.last_modified > last_modified:
            last_modified = log.last_modified

    return {
        "user": {
            "id": user.id,
            "username": user.username,
            "settings": json.loads(user.settings_json or "{}")
        },
        "collections": [
            {
                "id": collection.id,
                "owner_id": collection.owner_id,
                "name": collection.name,
                "description": collection.description,
                "last_modified": collection.last_modified
            }
            for collection in collections
        ],
        "cards": [card_to_dict(card) for card in cards],
        "study_logs": [
            {
                "id": log.id,
                "card_id": log.card_id,
                "user_id": log.user_id,
                "timestamp": log.timestamp,
                "ease": log.ease,
                "correct": log.correct,
                "response_time_ms": log.response_time_ms,
                "last_modified": log.last_modified
            }
            for log in study_logs
        ],
        "last_modified": last_modified
    }
