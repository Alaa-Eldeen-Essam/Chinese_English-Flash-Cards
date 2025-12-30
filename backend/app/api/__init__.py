from fastapi import APIRouter

from .auth import router as auth_router
from .admin import router as admin_router
from .cards import router as cards_router
from .collections import router as collections_router
from .dict import router as dict_router
from .importer import router as import_router
from .study import router as study_router

api_router = APIRouter(prefix="/api")
api_router.include_router(auth_router)
api_router.include_router(admin_router)
api_router.include_router(import_router)
api_router.include_router(collections_router)
api_router.include_router(cards_router)
api_router.include_router(study_router)
api_router.include_router(dict_router)
