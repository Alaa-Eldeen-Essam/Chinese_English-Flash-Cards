import json
import re
from datetime import datetime, timezone
from urllib.parse import urlencode
from uuid import uuid4

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from jose import JWTError
from sqlalchemy.orm import Session

from ..config import settings
from ..crud import (
    create_user,
    get_refresh_token,
    get_user_by_email,
    get_user_by_username,
    revoke_refresh_token,
    store_refresh_token,
    update_user_settings
)
from ..db import get_db
from ..models import User
from ..schemas import (
    AuthLoginRequest,
    AuthLogoutRequest,
    AuthRefreshRequest,
    AuthGoogleCallbackRequest,
    AuthRegisterRequest,
    AuthResponse,
    AuthToken,
    AuthUser,
    UserSettingsUpdate
)
from ..security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    hash_token,
    token_subject,
    verify_password
)
from .utils import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])

GOOGLE_CLIENT_ID = settings.google_client_id
GOOGLE_CLIENT_SECRET = settings.google_client_secret
GOOGLE_REDIRECT_URI = settings.google_redirect_uri


def _build_auth_response(user: User, access_token: str, refresh_token: str, access_expires: datetime) -> AuthResponse:
    settings = json.loads(user.settings_json or "{}")
    expires_in = max(0, int((access_expires - datetime.now(timezone.utc)).total_seconds()))
    return AuthResponse(
        user=AuthUser(
            id=user.id,
            username=user.username,
            email=user.email,
            settings=settings,
            auth_provider=user.auth_provider
        ),
        token=AuthToken(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=expires_in
        )
    )


def _sanitize_username(value: str) -> str:
    cleaned = re.sub(r"[^a-z0-9_]+", "", value.lower())
    return cleaned or "user"


def _ensure_unique_username(db: Session, base: str) -> str:
    candidate = _sanitize_username(base)
    if not get_user_by_username(db, candidate):
        return candidate
    suffix = uuid4().hex[:6]
    return f"{candidate}{suffix}"


def _exchange_google_code(code: str) -> dict:
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET or not GOOGLE_REDIRECT_URI:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Google OAuth is not configured"
        )
    try:
        response = httpx.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code"
            },
            timeout=10.0
        )
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=400, detail="Failed to exchange Google code") from exc
    return response.json()


def _fetch_google_token_info(id_token: str) -> dict:
    try:
        response = httpx.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": id_token},
            timeout=10.0
        )
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=401, detail="Invalid Google token") from exc
    return response.json()


@router.post("/register", response_model=AuthResponse)
def register(payload: AuthRegisterRequest, db: Session = Depends(get_db)) -> AuthResponse:
    if get_user_by_username(db, payload.username):
        raise HTTPException(status_code=400, detail="Username already exists")
    if payload.email and get_user_by_email(db, payload.email):
        raise HTTPException(status_code=400, detail="Email already exists")

    hashed = hash_password(payload.password)
    user = create_user(
        db,
        username=payload.username,
        hashed_password=hashed,
        email=payload.email
    )
    access_token, access_expires = create_access_token(user.id)
    refresh_token, refresh_expires, _ = create_refresh_token(user.id)
    store_refresh_token(db, user.id, hash_token(refresh_token), refresh_expires)
    return _build_auth_response(user, access_token, refresh_token, access_expires)


@router.post("/login", response_model=AuthResponse)
def login(payload: AuthLoginRequest, db: Session = Depends(get_db)) -> AuthResponse:
    user = get_user_by_username(db, payload.username)
    if not user and "@" in payload.username:
        user = get_user_by_email(db, payload.username)
    if not user or not user.is_active or user.auth_provider != "password":
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    access_token, access_expires = create_access_token(user.id)
    refresh_token, refresh_expires, _ = create_refresh_token(user.id)
    store_refresh_token(db, user.id, hash_token(refresh_token), refresh_expires)
    return _build_auth_response(user, access_token, refresh_token, access_expires)


@router.post("/refresh", response_model=AuthResponse)
def refresh(payload: AuthRefreshRequest, db: Session = Depends(get_db)) -> AuthResponse:
    try:
        token_payload = decode_token(payload.refresh_token)
        if token_payload.get("type") != "refresh":
            raise JWTError("Invalid token type")
        user_id = token_subject(token_payload)
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid refresh token") from exc

    token_hash = hash_token(payload.refresh_token)
    stored = get_refresh_token(db, token_hash)
    if not stored or stored.revoked_at is not None:
        raise HTTPException(status_code=401, detail="Refresh token revoked")
    if stored.expires_at < datetime.utcnow():
        raise HTTPException(status_code=401, detail="Refresh token expired")

    revoke_refresh_token(db, stored)
    access_token, access_expires = create_access_token(user_id)
    refresh_token, refresh_expires, _ = create_refresh_token(user_id)
    store_refresh_token(db, user_id, hash_token(refresh_token), refresh_expires)

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=404, detail="User not found")
    return _build_auth_response(user, access_token, refresh_token, access_expires)


@router.post("/logout")
def logout(payload: AuthLogoutRequest, db: Session = Depends(get_db)) -> dict:
    try:
        token_payload = decode_token(payload.refresh_token)
        if token_payload.get("type") != "refresh":
            raise JWTError("Invalid token type")
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid refresh token") from exc

    token_hash = hash_token(payload.refresh_token)
    stored = get_refresh_token(db, token_hash)
    if stored and stored.revoked_at is None:
        revoke_refresh_token(db, stored)
    return {"status": "logged_out"}


@router.get("/me", response_model=AuthUser)
def me(current_user: User = Depends(get_current_user)) -> AuthUser:
    settings = json.loads(current_user.settings_json or "{}")
    return AuthUser(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        settings=settings,
        auth_provider=current_user.auth_provider
    )


@router.patch("/settings", response_model=AuthUser)
def update_settings(
    payload: UserSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> AuthUser:
    user = update_user_settings(db, current_user, payload.settings)
    settings = json.loads(user.settings_json or "{}")
    return AuthUser(
        id=user.id,
        username=user.username,
        email=user.email,
        settings=settings,
        auth_provider=user.auth_provider
    )


@router.get("/google/start")
def google_start(state: str | None = None) -> dict:
    if not GOOGLE_CLIENT_ID or not GOOGLE_REDIRECT_URI:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Google OAuth is not configured"
        )
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "consent"
    }
    if state:
        params["state"] = state
    auth_url = "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params)
    return {"auth_url": auth_url}


@router.post("/google/callback", response_model=AuthResponse)
def google_callback(
    payload: AuthGoogleCallbackRequest,
    db: Session = Depends(get_db)
) -> AuthResponse:
    token_data = _exchange_google_code(payload.code)
    id_token = token_data.get("id_token")
    if not id_token:
        raise HTTPException(status_code=400, detail="Missing Google id_token")

    info = _fetch_google_token_info(id_token)
    if info.get("aud") != GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=401, detail="Invalid token audience")

    sub = info.get("sub")
    email = info.get("email")
    email_verified = str(info.get("email_verified", "")).lower() == "true"

    if not sub:
        raise HTTPException(status_code=400, detail="Missing Google subject")

    user = db.query(User).filter(
        User.auth_provider == "google",
        User.oauth_subject == sub
    ).first()

    if not user and email:
        existing = get_user_by_email(db, email)
        if existing and existing.auth_provider != "google":
            raise HTTPException(
                status_code=409,
                detail="Email already registered with password login"
            )
        if existing and existing.auth_provider == "google":
            existing.oauth_subject = sub
            db.commit()
            user = existing

    if not user:
        if not email or not email_verified:
            raise HTTPException(status_code=400, detail="Verified email required")
        base_username = email.split("@")[0]
        username = _ensure_unique_username(db, base_username)
        user = create_user(
            db,
            username=username,
            hashed_password=hash_password(uuid4().hex),
            email=email,
            auth_provider="google",
            oauth_subject=sub
        )

    access_token, access_expires = create_access_token(user.id)
    refresh_token, refresh_expires, _ = create_refresh_token(user.id)
    store_refresh_token(db, user.id, hash_token(refresh_token), refresh_expires)
    return _build_auth_response(user, access_token, refresh_token, access_expires)
