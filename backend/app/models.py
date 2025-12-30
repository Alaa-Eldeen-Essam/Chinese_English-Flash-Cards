from datetime import datetime
from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from .db import Base


class Flashcard(Base):
    __tablename__ = "flashcards"

    id = Column(Integer, primary_key=True, index=True)
    hanzi = Column(String, nullable=False)
    pinyin = Column(String, nullable=False)
    english = Column(String, nullable=False)
    ease_factor = Column(Float, default=2.5)
    interval_days = Column(Integer, default=0)
    repetition = Column(Integer, default=0)
    due_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

    reviews = relationship("Review", back_populates="card")


class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    card_id = Column(Integer, ForeignKey("flashcards.id"), nullable=False)
    rating = Column(Integer, nullable=False)
    reviewed_at = Column(DateTime, default=datetime.utcnow)

    card = relationship("Flashcard", back_populates="reviews")
