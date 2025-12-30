from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class HealthResponse(BaseModel):
    status: str


class AuthRegisterRequest(BaseModel):
    username: str
    password: str
    email: str | None = None


class AuthLoginRequest(BaseModel):
    username: str
    password: str


class AuthUser(BaseModel):
    id: int
    username: str
    email: str | None = None
    settings: dict
    auth_provider: str


class AuthToken(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class AuthResponse(BaseModel):
    user: AuthUser
    token: AuthToken


class AuthRefreshRequest(BaseModel):
    refresh_token: str


class AuthLogoutRequest(BaseModel):
    refresh_token: str


class UserSettingsUpdate(BaseModel):
    settings: dict


class CollectionCreate(BaseModel):
    name: str
    description: str = ""


class CollectionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    owner_id: int
    name: str
    description: str
    last_modified: datetime


class CollectionUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


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
    collection_ids: List[int] = Field(default_factory=list)
    last_modified: datetime


class CardUpdate(BaseModel):
    simplified: str | None = None
    pinyin: str | None = None
    meanings: List[str] | None = None
    examples: List[str] | None = None
    tags: List[str] | None = None
    collection_ids: List[int] | None = None


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


class CollectionSync(BaseModel):
    id: int
    name: str
    description: str = ""
    last_modified: datetime


class CardSync(BaseModel):
    id: int
    simplified: str
    pinyin: str = ""
    meanings: List[str] = Field(default_factory=list)
    examples: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    created_from_dict_id: Optional[int] = None
    collection_ids: List[int] = Field(default_factory=list)
    easiness: float = 2.5
    interval_days: int = 0
    repetitions: int = 0
    next_due: datetime
    last_modified: datetime


class StudyLogSync(BaseModel):
    id: int
    card_id: int
    user_id: int
    timestamp: datetime
    ease: int
    correct: bool
    response_time_ms: int
    last_modified: datetime


class SyncRequest(BaseModel):
    user_id: str = "me"
    cards: List[CardSync] = Field(default_factory=list)
    collections: List[CollectionSync] = Field(default_factory=list)
    study_logs: List[StudyLogSync] = Field(default_factory=list)
    last_modified: Optional[datetime] = None


class SyncResponse(BaseModel):
    status: str
    received: dict
    id_map: dict = Field(default_factory=dict)


class ImportUploadResponse(BaseModel):
    file_id: str
    filename: str
    path: str
    size: int


class ImportTriggerRequest(BaseModel):
    file_id: str
    file_type: str = Field(default="cedict", pattern="^(cedict|csv)$")
    csv_mapping: dict | None = None
    pinyin_style: str = Field(default="numbers", pattern="^(numbers|diacritics|none)$")
    dedupe: bool = True
    replace: bool = False


class ImportJobResponse(BaseModel):
    job_id: str
    status: str


class ImportStatusResponse(BaseModel):
    job_id: str
    status: str
    progress: int
    logs: list
    stats: dict | None = None
    created_at: datetime
    finished_at: datetime | None = None
