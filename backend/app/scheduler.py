from datetime import datetime
from typing import List, Optional

from sqlalchemy.orm import Session

from .models import Card, StudyLog, card_collection


def recommend(
    db: Session,
    user_id: int,
    n: int = 20,
    collection_id: Optional[int] = None
) -> List[Card]:
    now = datetime.utcnow()
    due_query = db.query(Card).filter(Card.owner_id == user_id)
    if collection_id is not None:
        due_query = due_query.join(card_collection).filter(
            card_collection.c.collection_id == collection_id
        )
    due_cards = (
        due_query
        .filter(Card.next_due <= now)
        .order_by(Card.next_due.asc())
        .limit(n)
        .all()
    )

    if len(due_cards) >= n:
        return due_cards

    remaining = n - len(due_cards)
    due_ids = {card.id for card in due_cards}

    failed_query = (
        db.query(StudyLog.card_id)
        .join(Card, Card.id == StudyLog.card_id)
        .filter(StudyLog.user_id == user_id)
        .filter(Card.owner_id == user_id)
        .filter(StudyLog.ease <= 2)
    )
    if collection_id is not None:
        failed_query = failed_query.join(card_collection).filter(
            card_collection.c.collection_id == collection_id
        )
    failed_card_ids = (
        failed_query
        .order_by(StudyLog.timestamp.desc())
        .limit(50)
        .all()
    )

    failed_ids = [row[0] for row in failed_card_ids if row[0] not in due_ids]
    if not failed_ids:
        return due_cards

    fallback_query = db.query(Card).filter(Card.owner_id == user_id)
    if collection_id is not None:
        fallback_query = fallback_query.join(card_collection).filter(
            card_collection.c.collection_id == collection_id
        )
    fallback_cards = (
        fallback_query
        .filter(Card.id.in_(failed_ids))
        .limit(remaining)
        .all()
    )

    return due_cards + fallback_cards
