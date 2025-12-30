from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..crud import card_to_dict, record_study
from ..db import get_db
from ..schemas import CardOut, StudyResponseIn, StudyResponseOut, StudyScheduleOut
from ..scheduler import recommend
from .utils import resolve_user_id

router = APIRouter(prefix="/study", tags=["study"])


@router.get("/schedule", response_model=StudyScheduleOut)
def get_schedule(
    user_id: str = "me",
    n: int = 20,
    db: Session = Depends(get_db)
) -> StudyScheduleOut:
    owner_id = resolve_user_id(db, user_id)
    cards = recommend(db, owner_id, n=n)
    return StudyScheduleOut(
        generated_at=datetime.utcnow(),
        count=len(cards),
        cards=[CardOut(**card_to_dict(card)) for card in cards]
    )


@router.post("/response", response_model=StudyResponseOut)
def post_response(
    payload: StudyResponseIn,
    db: Session = Depends(get_db)
) -> StudyResponseOut:
    owner_id = resolve_user_id(db, payload.user_id)
    try:
        card, log = record_study(
            db,
            owner_id,
            payload.card_id,
            payload.q,
            payload.response_time_ms
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return StudyResponseOut(
        card=CardOut(**card_to_dict(card)),
        logged_at=log.timestamp
    )
