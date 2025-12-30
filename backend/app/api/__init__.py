from fastapi import APIRouter

from .admin import router as admin_router
from .cards import router as cards_router
from .collections import router as collections_router
from .study import router as study_router

api_router = APIRouter(prefix="/api")
api_router.include_router(admin_router)
api_router.include_router(collections_router)
api_router.include_router(cards_router)
api_router.include_router(study_router)
