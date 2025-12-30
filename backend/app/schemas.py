from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class FlashcardBase(BaseModel):
    hanzi: str
    pinyin: str
    english: str


class FlashcardCreate(FlashcardBase):
    ease_factor: float = 2.5
    interval_days: int = 0
    repetition: int = 0
    due_at: datetime | None = None


class FlashcardOut(FlashcardBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ease_factor: float
    interval_days: int
    repetition: int
    due_at: datetime


class ReviewCreate(BaseModel):
    card_id: int
    rating: int = Field(ge=0, le=5)


class ReviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    card_id: int
    rating: int
    reviewed_at: datetime


class HealthResponse(BaseModel):
    status: str
