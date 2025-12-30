from datetime import datetime, timedelta

from .models import Card


def apply_sm2(card: Card, quality: int, now: datetime | None = None) -> Card:
    if now is None:
        now = datetime.utcnow()

    if quality < 3:
        card.repetitions = 0
        card.interval_days = 1
    else:
        card.repetitions += 1
        if card.repetitions == 1:
            card.interval_days = 1
        elif card.repetitions == 2:
            card.interval_days = 6
        else:
            card.interval_days = round(card.interval_days * card.easiness)

    delta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
    card.easiness = max(1.3, card.easiness + delta)
    card.next_due = now + timedelta(days=card.interval_days)
    card.updated_at = now
    card.last_modified = now
    return card
