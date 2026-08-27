"""JWT minting and the FastAPI dependencies that resolve the caller."""

from datetime import datetime, timedelta, timezone

from fastapi import Cookie, Depends, HTTPException, Request, status
from jose import JWTError, jwt

from src.config.settings import settings

# Cookie max-age and token expiry must agree; both read this.
TOKEN_TTL_DAYS = 7


def create_access_token(data: dict) -> str:
    """Sign a JWT that expires in TOKEN_TTL_DAYS."""
    payload = {**data, "exp": datetime.now(timezone.utc) + timedelta(days=TOKEN_TTL_DAYS)}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and validate a JWT; raises 401 on any failure."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        if payload.get("sub") is None:
            raise ValueError("missing sub")
        return payload
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        )


def user_id_from_token(token: str) -> int:
    """Return the user id carried by a raw token — for callers without a Request."""
    return int(decode_token(token)["sub"])


def token_from_request(request: Request, access_token: str | None) -> str | None:
    """Read the JWT from the access_token cookie, else the Bearer header."""
    if access_token:
        return access_token
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[len("Bearer "):].strip()
    return None


async def get_current_user(
    request: Request,
    access_token: str | None = Cookie(default=None),
) -> dict:
    """Dependency: the decoded token payload. 401 if neither source has one."""
    token = token_from_request(request, access_token)
    if token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated — no access_token cookie or Authorization header",
        )
    return decode_token(token)


async def get_current_user_id(user: dict = Depends(get_current_user)) -> int:
    """Dependency: the authenticated user's integer id."""
    try:
        return int(user["sub"])
    except (KeyError, ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is missing a valid user identifier",
        )
