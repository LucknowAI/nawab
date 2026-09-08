"""Feedback routes."""

from fastapi import APIRouter, Depends, Query, status

from src.auth.jwt_utils import get_current_user_id
from src.config.settings import settings
from src.handlers import feedback as handler
from src.schemas.response import ok

feedback_router = APIRouter(
    prefix="/feedback",
    tags=["Feedback"],
    responses={404: {"description": "Not found"}},
)


@feedback_router.post("/", status_code=status.HTTP_201_CREATED)
async def submit_feedback(
    body: handler.FeedbackRequest,
    user_id: int = Depends(get_current_user_id),
):
    return ok(await handler.create_feedback(user_id, body.message), status.HTTP_201_CREATED)


@feedback_router.get("/")
async def list_my_feedback(
    user_id: int = Depends(get_current_user_id),
    limit: int = Query(default=50, ge=1, le=settings.MAX_LIST_LIMIT),
    offset: int = Query(default=0, ge=0),
):
    return ok(await handler.list_feedback(user_id, limit, offset))
