from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Tuple

from jose import JWTError, jwt
from passlib.context import CryptContext

from .config import settings

SECRET_KEY = settings.jwt_secret
ALGORITHM = settings.jwt_algorithm
ACCESS_TOKEN_EXPIRE_MINUTES = settings.jwt_access_expires_minutes
REFRESH_TOKEN_EXPIRE_DAYS = settings.jwt_refresh_expires_days

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    return pwd_context.verify(password, hashed_password)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _create_token(payload: Dict[str, Any], expires_delta: timedelta) -> Tuple[str, datetime]:
    now = datetime.now(timezone.utc)
    expire = now + expires_delta
    to_encode = {
        **payload,
        "iat": now,
        "exp": expire
    }
    token = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return token, expire


def create_access_token(user_id: int) -> Tuple[str, datetime]:
    return _create_token(
        {"sub": str(user_id), "type": "access"},
        timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )


def create_refresh_token(user_id: int) -> Tuple[str, datetime, str]:
    jti = str(uuid.uuid4())
    token, expires = _create_token(
        {"sub": str(user_id), "type": "refresh", "jti": jti},
        timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    )
    return token, expires, jti


def decode_token(token: str) -> Dict[str, Any]:
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])


def token_subject(payload: Dict[str, Any]) -> int:
    sub = payload.get("sub")
    if not sub:
        raise JWTError("Missing subject")
    return int(sub)
