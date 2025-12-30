from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..crud import card_to_dict, create_card, list_cards
from ..db import get_db
from ..schemas import CardCreate, CardOut
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
