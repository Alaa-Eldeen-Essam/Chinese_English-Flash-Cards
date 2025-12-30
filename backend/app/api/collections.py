from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..crud import create_collection, list_collections
from ..db import get_db
from ..schemas import CollectionCreate, CollectionOut
from .utils import resolve_user_id

router = APIRouter(prefix="/collections", tags=["collections"])


@router.get("/", response_model=list[CollectionOut])
def get_collections(user_id: str = "me", db: Session = Depends(get_db)) -> list[CollectionOut]:
    owner_id = resolve_user_id(db, user_id)
    return list_collections(db, owner_id)


@router.post("/", response_model=CollectionOut)
def create_collection_endpoint(
    payload: CollectionCreate,
    user_id: str = "me",
    db: Session = Depends(get_db)
) -> CollectionOut:
    owner_id = resolve_user_id(db, user_id)
    return create_collection(db, owner_id, payload.name, payload.description)
