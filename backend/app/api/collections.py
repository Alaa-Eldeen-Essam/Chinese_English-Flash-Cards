from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..crud import create_collection, delete_collection, list_collections, update_collection
from ..db import get_db
from ..models import Collection, User
from ..schemas import CollectionCreate, CollectionOut, CollectionUpdate
from .utils import get_current_user

router = APIRouter(prefix="/collections", tags=["collections"])


@router.get("/", response_model=list[CollectionOut])
def get_collections(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> list[CollectionOut]:
    return list_collections(db, current_user.id)


@router.post("/", response_model=CollectionOut)
def create_collection_endpoint(
    payload: CollectionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> CollectionOut:
    return create_collection(db, current_user.id, payload.name, payload.description)


@router.put("/{collection_id}", response_model=CollectionOut)
def update_collection_endpoint(
    collection_id: int,
    payload: CollectionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> CollectionOut:
    collection = db.query(Collection).filter(
        Collection.owner_id == current_user.id,
        Collection.id == collection_id
    ).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    updated = update_collection(db, collection, payload.name, payload.description)
    return updated


@router.delete("/{collection_id}")
def delete_collection_endpoint(
    collection_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> dict:
    collection = db.query(Collection).filter(
        Collection.owner_id == current_user.id,
        Collection.id == collection_id
    ).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    delete_collection(db, collection)
    return {"status": "deleted"}
