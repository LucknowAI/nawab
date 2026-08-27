"""Auth handlers: Google sign-in, email OTP login, and profile reads/writes."""

import random
from datetime import datetime, timezone

from fastapi import HTTPException
from google.auth.transport import requests as g_requests
from google.oauth2 import id_token
from pydantic import BaseModel, EmailStr
from sqlalchemy import select

from sqlalchemy_models.user import UserModel
from src.auth.jwt_utils import TOKEN_TTL_DAYS, create_access_token
from src.cities.registry import CITY_REGISTRY
from src.config.settings import settings
from src.database.db import get_db
from src.database.redis import redis_manager
from src.utils.email_sender import send_otp_email_safe

OTP_TTL_SECONDS = 120
DEFAULT_CITY = "lucknow"


# ── Request models ──────────────────────────────────────────────────────────

class GoogleLoginRequest(BaseModel):
    """Payload sent by the frontend after completing Google Sign-In."""

    id_token: str


class ProfileUpdateRequest(BaseModel):
    default_city_id: str


class OtpRequest(BaseModel):
    email: EmailStr


class OtpVerifyRequest(BaseModel):
    email: EmailStr
    otp: str


class GoogleUserInfo(BaseModel):
    """Fields extracted from Google's verified ID-token payload."""

    google_id: str
    email: str
    email_verified: bool
    full_name: str | None = None
    given_name: str | None = None
    family_name: str | None = None
    picture: str | None = None


# ── Shared pieces ───────────────────────────────────────────────────────────

def verify_google_token(raw_token: str) -> GoogleUserInfo:
    """Verify a Google ID-token against Google's public keys."""
    try:
        payload = id_token.verify_oauth2_token(
            raw_token,
            g_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
            clock_skew_in_seconds=10,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid Google token: {exc}")

    return GoogleUserInfo(
        google_id=payload["sub"],
        email=payload["email"],
        email_verified=payload.get("email_verified", False),
        full_name=payload.get("name"),
        given_name=payload.get("given_name"),
        family_name=payload.get("family_name"),
        picture=payload.get("picture"),
    )


async def upsert_user(email: str, google_info: GoogleUserInfo | None = None) -> UserModel:
    """Find or create the user for this login, refreshing what the provider sent.

    Google logins look up by google_id first, then by email — which links an
    existing OTP-only account to the Google account instead of duplicating it.
    """
    async with get_db() as db:
        user = None
        if google_info is not None:
            result = await db.execute(
                select(UserModel).where(UserModel.google_id == google_info.google_id)
            )
            user = result.scalar_one_or_none()

        if user is None:
            result = await db.execute(select(UserModel).where(UserModel.email == email))
            user = result.scalar_one_or_none()

        now = datetime.now(timezone.utc)

        if user is None:
            user = UserModel(
                email=email,
                google_id=google_info.google_id if google_info else None,
                email_verified=google_info.email_verified if google_info else True,
                auth_provider="google" if google_info else "email",
                last_login=now,
            )
            db.add(user)

        if google_info is not None:
            user.google_id = google_info.google_id  # links a previously OTP-only account
            user.email = google_info.email
            user.email_verified = google_info.email_verified
            user.full_name = google_info.full_name
            user.given_name = google_info.given_name
            user.family_name = google_info.family_name
            user.picture = google_info.picture
            user.auth_provider = "google"
        else:
            user.email_verified = True

        user.last_login = now
        await db.flush()
        await db.refresh(user)
        return user


def build_user_payload(user: UserModel, token: str = "") -> dict:
    """The user shape every auth endpoint returns. Token is empty where none is issued."""
    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "picture": user.picture,
        "default_city_id": user.default_city_id or DEFAULT_CITY,
    }


def set_auth_cookie(response, token: str) -> None:
    """Set the HttpOnly session cookie on the response being returned.

    It must be the returned response object: cookies set on FastAPI's injected
    Response are dropped when the route returns a Response of its own, which
    every route here does to carry the envelope.

    secure=True is required on HTTPS deploys, and browsers silently drop
    samesite='none' without it — that pairing is what makes a cross-domain
    frontend work.
    """
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=TOKEN_TTL_DAYS * 24 * 60 * 60,
    )


def clear_auth_cookie(response) -> None:
    """Delete the session cookie from the response being returned."""
    response.delete_cookie(
        key="access_token",
        httponly=True,
        samesite=settings.COOKIE_SAMESITE,
        secure=settings.COOKIE_SECURE,
    )


async def _load_user(user_id: int) -> UserModel:
    async with get_db() as db:
        result = await db.execute(select(UserModel).where(UserModel.id == user_id))
        user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def _issue_session(user: UserModel) -> dict:
    """Mint a JWT for the user and return the login payload carrying it.

    The caller sets the cookie from payload["access_token"].
    """
    token = create_access_token({"sub": str(user.id), "email": user.email})
    return build_user_payload(user, token)


# ── Endpoint handlers ───────────────────────────────────────────────────────

async def login_with_google(raw_id_token: str) -> dict:
    """Exchange a Google ID-token for an application JWT."""
    google_info = verify_google_token(raw_id_token)
    user = await upsert_user(google_info.email, google_info)
    return _issue_session(user)


async def logout_user() -> dict:
    """The logout payload. The route clears the cookie on its response."""
    return {"message": "Logged out successfully"}


async def get_current_profile(user_id: int) -> dict:
    """Return the logged-in user's profile. No token is re-issued."""
    return build_user_payload(await _load_user(user_id))


async def update_profile_city(user_id: int, default_city_id: str) -> dict:
    """Set the user's preferred city."""
    if default_city_id not in CITY_REGISTRY:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown city: {default_city_id!r}. Valid values: {list(CITY_REGISTRY)}",
        )

    async with get_db() as db:
        result = await db.execute(select(UserModel).where(UserModel.id == user_id))
        user = result.scalar_one_or_none()
        if user is None:
            raise HTTPException(status_code=404, detail="User not found")
        user.default_city_id = default_city_id

    return {"default_city_id": default_city_id}


async def send_login_otp(email: str, background) -> dict:
    """Store a 6-digit OTP and mail it in the background.

    Sending inline meant a full Gmail SMTP connect + STARTTLS + auth + send
    (~4.4s measured, up to aiosmtplib's timeout on a bad day) happened before
    the response was written, so the login form sat on "Sending…" looking
    frozen. The OTP is already in Redis by then, so delivery is not needed for
    the response to be correct; failures are logged inside send_otp_email_safe
    and the client's resend button covers a lost mail.
    """
    email = email.lower()

    if not redis_manager.is_connected:
        raise HTTPException(status_code=503, detail="OTP service temporarily unavailable")

    if not await redis_manager.check_otp_rate_limit(email):
        raise HTTPException(
            status_code=429,
            detail="Too many OTP requests. Please wait a few minutes before trying again.",
        )

    otp = f"{random.SystemRandom().randint(0, 999_999):06d}"
    if not await redis_manager.save_otp(email, otp, ttl=OTP_TTL_SECONDS):
        raise HTTPException(status_code=503, detail="OTP service temporarily unavailable")

    background.add_task(send_otp_email_safe, email, otp)
    return {"message": "OTP sent to your email address", "expires_in": OTP_TTL_SECONDS}


async def verify_login_otp(email: str, otp: str) -> dict:
    """Verify an OTP and issue a JWT. The OTP is consumed on first success."""
    email = email.lower()

    if not redis_manager.is_connected:
        raise HTTPException(status_code=503, detail="OTP service temporarily unavailable")

    if not await redis_manager.verify_and_consume_otp(email, otp):
        raise HTTPException(status_code=401, detail="Invalid or expired OTP")

    user = await upsert_user(email)
    return _issue_session(user)


if __name__ == "__main__":
    import asyncio

    class _FakeResponse:
        """Captures set_cookie/delete_cookie instead of touching a real response."""

        def __init__(self):
            self.cookies = {}

        def set_cookie(self, key, value, **kw):
            self.cookies[key] = (value, kw)

        def delete_cookie(self, key, **kw):
            self.cookies.pop(key, None)

    async def _demo():
        """Exercises token verification, payload shape, and cookie handling.

        Deliberately does not send an OTP or mint a session for a real user.
        """
        try:
            verify_google_token("not-a-real-token")
            raise AssertionError("expected a 400 for a bogus token")
        except HTTPException as exc:
            assert exc.status_code == 400

        user = UserModel(id=1, email="demo@example.com", full_name="Demo", picture=None)
        payload = build_user_payload(user)
        assert payload["access_token"] == "" and payload["user_id"] == 1
        assert payload["default_city_id"] == DEFAULT_CITY

        response = _FakeResponse()
        set_auth_cookie(response, "token123")
        value, kw = response.cookies["access_token"]
        assert value == "token123" and kw["httponly"] is True
        assert kw["max_age"] == TOKEN_TTL_DAYS * 24 * 60 * 60

        assert (await logout_user())["message"]
        clear_auth_cookie(response)
        assert "access_token" not in response.cookies
        print("ok — token rejection, payload shape, cookie set and cleared")

    asyncio.run(_demo())
