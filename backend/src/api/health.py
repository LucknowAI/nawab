"""Health and metrics routes."""

from fastapi import APIRouter, status

from src.handlers import health as handler
from src.schemas.response import ok

health_router = APIRouter(prefix="/health", tags=["Health"])


@health_router.get("/")
async def health_check():
    """503 when Postgres is down — deploy-dev.sh gates a rollout on this."""
    payload = await handler.check_health()
    healthy = payload["status"] == "healthy"
    return ok(payload, status.HTTP_200_OK if healthy else status.HTTP_503_SERVICE_UNAVAILABLE)


@health_router.get("/metrics")
async def metrics():
    return ok(await handler.get_system_metrics())
