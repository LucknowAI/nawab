"""Auth routes — Google sign-in, email OTP, session and profile.

The session cookie is set on the response these routes return, not on an
injected Response: FastAPI drops the latter when a route returns its own
Response, which every route here does to carry the envelope.
"""

from fastapi import APIRouter, BackgroundTasks, Depends

from src.auth.jwt_utils import get_current_user_id
from src.handlers import auth as handler
from src.schemas.response import ok

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/google")
async def google_login(body: handler.GoogleLoginRequest):
    """Verify a Google ID-token, upsert the user, and start a session."""
    payload = await handler.login_with_google(body.id_token)
    response = ok(payload)
    handler.set_auth_cookie(response, payload["access_token"])
    return response


@router.post("/logout")
async def logout():
    response = ok(await handler.logout_user())
    handler.clear_auth_cookie(response)
    return response


@router.get("/me")
async def me(user_id: int = Depends(get_current_user_id)):
    """Return the caller's profile, identified by the cookie or Bearer token."""
    return ok(await handler.get_current_profile(user_id))


@router.patch("/profile")
async def update_profile(
    body: handler.ProfileUpdateRequest,
    user_id: int = Depends(get_current_user_id),
):
    return ok(await handler.update_profile_city(user_id, body.default_city_id))


@router.post("/request-otp")
async def request_otp(body: handler.OtpRequest, background: BackgroundTasks):
    return ok(await handler.send_login_otp(body.email, background))


@router.post("/verify-otp")
async def verify_otp(body: handler.OtpVerifyRequest):
    payload = await handler.verify_login_otp(body.email, body.otp)
    response = ok(payload)
    handler.set_auth_cookie(response, payload["access_token"])
    return response
