from datetime import datetime, timedelta

from ..models import Flashcard


def schedule_review(card: Flashcard, rating: int, now: datetime | None = None) -> Flashcard:
    if now is None:
        now = datetime.utcnow()

    if rating < 3:
        card.repetition = 0
        card.interval_days = 1
    else:
        if card.repetition == 0:
            card.interval_days = 1
        elif card.repetition == 1:
            card.interval_days = 6
        else:
            card.interval_days = round(card.interval_days * card.ease_factor)
        card.repetition += 1

    delta = 0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02)
    card.ease_factor = max(1.3, card.ease_factor + delta)
    card.due_at = now + timedelta(days=card.interval_days)
    card.updated_at = now
    return card
