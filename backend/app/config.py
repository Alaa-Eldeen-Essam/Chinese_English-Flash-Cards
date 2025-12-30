from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover - optional dependency
    load_dotenv = None


BASE_DIR = Path(__file__).resolve().parent.parent


def _load_env() -> None:
    if load_dotenv:
        root_env = BASE_DIR.parent / ".env"
        local_env = BASE_DIR / ".env"
        if root_env.exists():
            load_dotenv(root_env)
        elif local_env.exists():
            load_dotenv(local_env)
        else:
            load_dotenv()


def _split_csv(value: str) -> List[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def _normalize_sqlite_url(url: str) -> str:
    if not url.startswith("sqlite:///"):
        return url
    path = url.replace("sqlite:///", "", 1)
    if path in ("", ":memory:"):
        return url
    if path.startswith("/"):
        return url
    absolute = (BASE_DIR / path).resolve()
    return f"sqlite:///{absolute}"


@dataclass(frozen=True)
class Settings:
    app_env: str
    app_name: str
    api_host: str
    api_port: int
    log_level: str
    database_url: str
    cors_origins: List[str]
    jwt_secret: str
    jwt_algorithm: str
    jwt_access_expires_minutes: int
    jwt_refresh_expires_days: int
    google_client_id: Optional[str]
    google_client_secret: Optional[str]
    google_redirect_uri: Optional[str]


_load_env()

_default_db = f"sqlite:///{BASE_DIR / 'data' / 'flashcards.db'}"

settings = Settings(
    app_env=os.getenv("APP_ENV", "development"),
    app_name=os.getenv("APP_NAME", "Simplified Chinese Flashcards API"),
    api_host=os.getenv("API_HOST", "127.0.0.1"),
    api_port=int(os.getenv("API_PORT", "8000")),
    log_level=os.getenv("LOG_LEVEL", "info"),
    database_url=_normalize_sqlite_url(os.getenv("DATABASE_URL", _default_db)),
    cors_origins=_split_csv(
        os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
    ),
    jwt_secret=os.getenv("JWT_SECRET", "dev-secret-change-me"),
    jwt_algorithm=os.getenv("JWT_ALGORITHM", "HS256"),
    jwt_access_expires_minutes=int(os.getenv("JWT_ACCESS_EXPIRE_MINUTES", "30")),
    jwt_refresh_expires_days=int(os.getenv("JWT_REFRESH_EXPIRE_DAYS", "14")),
    google_client_id=os.getenv("GOOGLE_CLIENT_ID"),
    google_client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
    google_redirect_uri=os.getenv("GOOGLE_REDIRECT_URI")
)
