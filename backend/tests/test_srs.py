from datetime import datetime

from app.models import Flashcard
from app.services.srs import schedule_review


def test_schedule_review_resets_on_low_rating():
    card = Flashcard(
        hanzi="NI HAO",
        pinyin="ni3 hao3",
        english="hello",
        ease_factor=2.5,
        interval_days=3,
        repetition=2,
        due_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )

    updated = schedule_review(card, rating=1, now=datetime(2024, 1, 1))

    assert updated.repetition == 0
    assert updated.interval_days == 1
    assert updated.ease_factor >= 1.3
