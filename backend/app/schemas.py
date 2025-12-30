from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class HealthResponse(BaseModel):
    status: str


class CollectionCreate(BaseModel):
    name: str
    description: str = ""


class CollectionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    owner_id: int
    name: str
    description: str


class CardCreate(BaseModel):
    simplified: str
    pinyin: str = ""
    meanings: List[str] = Field(default_factory=list)
    examples: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    created_from_dict_id: Optional[int] = None
    collection_ids: List[int] = Field(default_factory=list)


class CardOut(BaseModel):
    id: int
    owner_id: int
    simplified: str
    pinyin: str
    meanings: List[str]
    examples: List[str]
    tags: List[str]
    created_from_dict_id: Optional[int]
    easiness: float
    interval_days: int
    repetitions: int
    next_due: datetime


class StudyScheduleOut(BaseModel):
    generated_at: datetime
    count: int
    cards: List[CardOut]


class StudyResponseIn(BaseModel):
    card_id: int
    q: int = Field(ge=0, le=5)
    response_time_ms: int = 0
    user_id: str = "me"


class StudyResponseOut(BaseModel):
    card: CardOut
    logged_at: datetime


class DumpResponse(BaseModel):
    user: dict
    collections: list
    cards: list
    study_logs: list
    last_modified: datetime


class SyncRequest(BaseModel):
    user_id: str = "me"
    cards: list = Field(default_factory=list)
    collections: list = Field(default_factory=list)
    study_logs: list = Field(default_factory=list)
    last_modified: Optional[datetime] = None


class SyncResponse(BaseModel):
    status: str
    received: dict
