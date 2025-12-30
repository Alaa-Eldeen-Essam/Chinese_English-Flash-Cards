from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from .config import settings

DATABASE_URL = settings.database_url

if DATABASE_URL.startswith("sqlite:///"):
    path = DATABASE_URL.replace("sqlite:///", "", 1)
    if path and path != ":memory:":
        db_path = Path(path).resolve()
        db_path.parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
