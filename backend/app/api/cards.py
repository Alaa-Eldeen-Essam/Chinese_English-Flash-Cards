from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..crud import card_to_dict, create_card, delete_card, list_cards, update_card
from ..db import get_db
from ..schemas import CardCreate, CardOut, CardUpdate
from ..models import Card
from .utils import resolve_user_id

router = APIRouter(prefix="/cards", tags=["cards"])


@router.get("/", response_model=list[CardOut])
def search_cards(
    collection: int | None = None,
    query: str | None = None,
    user_id: str = "me",
    db: Session = Depends(get_db)
) -> list[CardOut]:
    owner_id = resolve_user_id(db, user_id)
    cards = list_cards(db, owner_id, collection_id=collection, query=query)
    return [CardOut(**card_to_dict(card)) for card in cards]


@router.post("/", response_model=CardOut)
def create_card_endpoint(
    payload: CardCreate,
    user_id: str = "me",
    db: Session = Depends(get_db)
) -> CardOut:
    owner_id = resolve_user_id(db, user_id)
    card = create_card(
        db,
        owner_id,
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
    user_id: str = "me",
    db: Session = Depends(get_db)
) -> CardOut:
    owner_id = resolve_user_id(db, user_id)
    card = db.query(Card).filter(
        Card.owner_id == owner_id,
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
    user_id: str = "me",
    db: Session = Depends(get_db)
) -> dict:
    owner_id = resolve_user_id(db, user_id)
    card = db.query(Card).filter(
        Card.owner_id == owner_id,
        Card.id == card_id
    ).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    delete_card(db, card)
    return {"status": "deleted"}
