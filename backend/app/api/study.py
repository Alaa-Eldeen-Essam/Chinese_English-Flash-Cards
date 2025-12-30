from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..crud import card_to_dict, record_study
from ..db import get_db
from ..models import User
from ..schemas import CardOut, StudyResponseIn, StudyResponseOut, StudyScheduleOut
from ..scheduler import recommend
from .utils import get_current_user

router = APIRouter(prefix="/study", tags=["study"])


@router.get("/schedule", response_model=StudyScheduleOut)
def get_schedule(
    n: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> StudyScheduleOut:
    cards = recommend(db, current_user.id, n=n)
    return StudyScheduleOut(
        generated_at=datetime.utcnow(),
        count=len(cards),
        cards=[CardOut(**card_to_dict(card)) for card in cards]
    )


@router.post("/response", response_model=StudyResponseOut)
def post_response(
    payload: StudyResponseIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> StudyResponseOut:
    try:
        card, log = record_study(
            db,
            current_user.id,
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
