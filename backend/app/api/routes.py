from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Flashcard, Review
from ..schemas import FlashcardCreate, FlashcardOut, HealthResponse, ReviewCreate
from ..services.srs import schedule_review

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    return HealthResponse(status="ok")


@router.get("/cards", response_model=list[FlashcardOut])
def list_cards(db: Session = Depends(get_db)) -> list[FlashcardOut]:
    return db.query(Flashcard).order_by(Flashcard.due_at).all()


@router.post("/cards", response_model=FlashcardOut)
def create_card(payload: FlashcardCreate, db: Session = Depends(get_db)) -> FlashcardOut:
    due_at = payload.due_at or datetime.utcnow()
    card = Flashcard(
        hanzi=payload.hanzi,
        pinyin=payload.pinyin,
        english=payload.english,
        ease_factor=payload.ease_factor,
        interval_days=payload.interval_days,
        repetition=payload.repetition,
        due_at=due_at,
        updated_at=datetime.utcnow()
    )
    db.add(card)
    db.commit()
    db.refresh(card)
    return card


@router.post("/reviews", response_model=FlashcardOut)
def review_card(payload: ReviewCreate, db: Session = Depends(get_db)) -> FlashcardOut:
    card = db.query(Flashcard).filter(Flashcard.id == payload.card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    schedule_review(card, payload.rating)
    db.add(Review(card_id=card.id, rating=payload.rating))
    db.commit()
    db.refresh(card)
    return card
