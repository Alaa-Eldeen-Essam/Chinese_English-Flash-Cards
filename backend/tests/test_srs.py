from datetime import datetime

from app.models import Card
from app.srs import apply_sm2


def test_apply_sm2_resets_on_low_quality():
    card = Card(
        owner_id=1,
        simplified="NI HAO",
        pinyin="ni3 hao3",
        meanings_json="[]",
        examples_json="[]",
        tags_json="[]",
        easiness=2.5,
        interval_days=3,
        repetitions=2,
        next_due=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )

    updated = apply_sm2(card, quality=1, now=datetime(2024, 1, 1))

    assert updated.repetitions == 0
    assert updated.interval_days == 1
    assert updated.easiness >= 1.3
