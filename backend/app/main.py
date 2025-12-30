from contextlib import asynccontextmanager

from fastapi import FastAPI

from .api import api_router
from .crud import ensure_demo_user
from .db import Base, SessionLocal, engine

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        ensure_demo_user(db)
    finally:
        db.close()
    yield


app = FastAPI(title="Simplified Chinese Flashcards API", version="0.2.0", lifespan=lifespan)
app.include_router(api_router)
