from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Table, Text
from sqlalchemy.orm import relationship

from .db import Base

card_collection = Table(
    "card_collection",
    Base.metadata,
    Column("card_id", Integer, ForeignKey("cards.id"), primary_key=True),
    Column("collection_id", Integer, ForeignKey("collections.id"), primary_key=True)
)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    settings_json = Column(Text, default="{}")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    last_modified = Column(DateTime, default=datetime.utcnow)

    collections = relationship("Collection", back_populates="owner")
    cards = relationship("Card", back_populates="owner")
    study_logs = relationship("StudyLog", back_populates="user")


class Collection(Base):
    __tablename__ = "collections"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    last_modified = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="collections")
    cards = relationship("Card", secondary=card_collection, back_populates="collections")


class Card(Base):
    __tablename__ = "cards"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    simplified = Column(String, nullable=False)
    pinyin = Column(String, default="")
    meanings_json = Column(Text, default="[]")
    examples_json = Column(Text, default="[]")
    created_from_dict_id = Column(Integer, nullable=True)
    tags_json = Column(Text, default="[]")

    easiness = Column(Float, default=2.5)
    interval_days = Column(Integer, default=0)
    repetitions = Column(Integer, default=0)
    next_due = Column(DateTime, default=datetime.utcnow)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    last_modified = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="cards")
    collections = relationship("Collection", secondary=card_collection, back_populates="cards")
    study_logs = relationship("StudyLog", back_populates="card")


class StudyLog(Base):
    __tablename__ = "study_logs"

    id = Column(Integer, primary_key=True, index=True)
    card_id = Column(Integer, ForeignKey("cards.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    ease = Column(Integer, nullable=False)
    correct = Column(Boolean, default=False)
    response_time_ms = Column(Integer, default=0)
    last_modified = Column(DateTime, default=datetime.utcnow)

    card = relationship("Card", back_populates="study_logs")
    user = relationship("User", back_populates="study_logs")


class DictWord(Base):
    __tablename__ = "dict_word"

    id = Column(Integer, primary_key=True, index=True)
    simplified = Column(String, nullable=False)
    traditional = Column(String, nullable=True)
    pinyin = Column(String, nullable=True)
    meanings = Column(Text, nullable=True)
    examples = Column(Text, nullable=True)
    tags = Column(Text, nullable=True)
    last_modified = Column(DateTime, default=datetime.utcnow)


class ImportFile(Base):
    __tablename__ = "import_files"

    id = Column(String, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    path = Column(String, nullable=False)
    size = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class ImportJob(Base):
    __tablename__ = "import_jobs"

    id = Column(String, primary_key=True, index=True)
    file_id = Column(String, ForeignKey("import_files.id"), nullable=False)
    file_type = Column(String, nullable=False)
    mapping_json = Column(Text, nullable=True)
    pinyin_style = Column(String, default="numbers")
    dedupe = Column(Boolean, default=True)
    replace = Column(Boolean, default=False)
    status = Column(String, default="queued")
    progress = Column(Integer, default=0)
    stats_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    finished_at = Column(DateTime, nullable=True)

    logs = relationship("ImportJobLog", back_populates="job")


class ImportJobLog(Base):
    __tablename__ = "import_job_logs"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(String, ForeignKey("import_jobs.id"), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    level = Column(String, default="info")
    message = Column(Text, nullable=False)

    job = relationship("ImportJob", back_populates="logs")
