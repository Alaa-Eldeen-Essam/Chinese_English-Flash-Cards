from datetime import datetime
from typing import List

from sqlalchemy.orm import Session

from .models import Card, StudyLog


def recommend(db: Session, user_id: int, n: int = 20) -> List[Card]:
    now = datetime.utcnow()
    due_cards = (
        db.query(Card)
        .filter(Card.owner_id == user_id)
        .filter(Card.next_due <= now)
        .order_by(Card.next_due.asc())
        .limit(n)
        .all()
    )

    if len(due_cards) >= n:
        return due_cards

    remaining = n - len(due_cards)
    due_ids = {card.id for card in due_cards}

    failed_card_ids = (
        db.query(StudyLog.card_id)
        .filter(StudyLog.user_id == user_id)
        .filter(StudyLog.ease <= 2)
        .order_by(StudyLog.timestamp.desc())
        .limit(50)
        .all()
    )

    failed_ids = [row[0] for row in failed_card_ids if row[0] not in due_ids]
    if not failed_ids:
        return due_cards

    fallback_cards = (
        db.query(Card)
        .filter(Card.owner_id == user_id)
        .filter(Card.id.in_(failed_ids))
        .limit(remaining)
        .all()
    )

    return due_cards + fallback_cards
