from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..crud import card_to_dict, create_card, delete_card, list_cards, update_card
from ..db import get_db
from ..schemas import CardCreate, CardOut, CardUpdate
from ..models import Card, User
from .utils import get_current_user

router = APIRouter(prefix="/cards", tags=["cards"])


@router.get("/", response_model=list[CardOut])
def search_cards(
    collection: int | None = None,
    query: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> list[CardOut]:
    cards = list_cards(db, current_user.id, collection_id=collection, query=query)
    return [CardOut(**card_to_dict(card)) for card in cards]


@router.post("/", response_model=CardOut)
def create_card_endpoint(
    payload: CardCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> CardOut:
    card = create_card(
        db,
        current_user.id,
        payload.simplified,
        payload.pinyin,
        payload.meanings,
        payload.examples,
        payload.tags,
        payload.created_from_dict_id,
        payload.collection_ids
    )
    return CardOut(**card_to_dict(card))


@router.put("/{card_id}", response_model=CardOut)
def update_card_endpoint(
    card_id: int,
    payload: CardUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> CardOut:
    card = db.query(Card).filter(
        Card.owner_id == current_user.id,
        Card.id == card_id
    ).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    updated = update_card(
        db,
        card,
        simplified=payload.simplified,
        pinyin=payload.pinyin,
        meanings=payload.meanings,
        examples=payload.examples,
        tags=payload.tags,
        collection_ids=payload.collection_ids
    )
    return CardOut(**card_to_dict(updated))


@router.delete("/{card_id}")
def delete_card_endpoint(
    card_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> dict:
    card = db.query(Card).filter(
        Card.owner_id == current_user.id,
        Card.id == card_id
    ).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    delete_card(db, card)
    return {"status": "deleted"}
