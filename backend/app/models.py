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
