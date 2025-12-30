from datetime import datetime
from fastapi import FastAPI

from .api.routes import router
from .db import Base, SessionLocal, engine
from .models import Flashcard

app = FastAPI(title="Simplified Chinese Flashcards API", version="0.1.0")
app.include_router(router)


def seed_demo_data() -> None:
    db = SessionLocal()
    try:
        if db.query(Flashcard).count() == 0:
            db.add(
                Flashcard(
                    hanzi="NI HAO",
                    pinyin="ni3 hao3",
                    english="hello",
                    ease_factor=2.5,
                    interval_days=0,
                    repetition=0,
                    due_at=datetime.utcnow(),
                    updated_at=datetime.utcnow()
                )
            )
            db.commit()
    finally:
        db.close()


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
    seed_demo_data()
