import json
from datetime import datetime, timezone

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
def google_start() -> dict:
    if not GOOGLE_CLIENT_ID or not GOOGLE_REDIRECT_URI:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Google OAuth is not configured"
        )
    auth_url = (
        "https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={GOOGLE_CLIENT_ID}"
        f"&redirect_uri={GOOGLE_REDIRECT_URI}"
        "&response_type=code"
        "&scope=openid%20email%20profile"
        "&access_type=offline"
        "&prompt=consent"
    )
    return {"auth_url": auth_url}


@router.post("/google/callback")
def google_callback() -> dict:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Google OAuth callback handler not implemented"
    )
