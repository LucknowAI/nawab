"""City routes — the frontend's city selector."""

from fastapi import APIRouter

from src.handlers import city as handler
from src.schemas.response import ok

city_router = APIRouter(prefix="/cities", tags=["Cities"])


@city_router.get("/")
async def get_cities():
    return ok(await handler.list_supported_cities())
