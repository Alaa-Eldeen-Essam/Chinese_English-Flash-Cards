from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..crud import create_collection, delete_collection, list_collections, update_collection
from ..db import get_db
from ..models import Collection
from ..schemas import CollectionCreate, CollectionOut, CollectionUpdate
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


@router.put("/{collection_id}", response_model=CollectionOut)
def update_collection_endpoint(
    collection_id: int,
    payload: CollectionUpdate,
    user_id: str = "me",
    db: Session = Depends(get_db)
) -> CollectionOut:
    owner_id = resolve_user_id(db, user_id)
    collection = db.query(Collection).filter(
        Collection.owner_id == owner_id,
        Collection.id == collection_id
    ).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    updated = update_collection(db, collection, payload.name, payload.description)
    return updated


@router.delete("/{collection_id}")
def delete_collection_endpoint(
    collection_id: int,
    user_id: str = "me",
    db: Session = Depends(get_db)
) -> dict:
    owner_id = resolve_user_id(db, user_id)
    collection = db.query(Collection).filter(
        Collection.owner_id == owner_id,
        Collection.id == collection_id
    ).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    delete_collection(db, collection)
    return {"status": "deleted"}
