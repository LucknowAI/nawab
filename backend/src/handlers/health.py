"""Health and metrics handlers."""

import time

import psutil
from sqlalchemy import text

from src.cities.registry import CITY_REGISTRY
from src.database.db import get_db
from src.database.redis import redis_manager


async def check_health() -> dict:
    """Report dependency status.

    Postgres is a hard dependency (auth, chat history) — unlike Redis there is
    no in-memory fallback, so a broken DB must fail the check rather than be
    silently ignored. deploy-dev.sh polls this to decide whether a rollout
    succeeded, and reads the status field.
    """
    try:
        redis_status = "healthy" if await redis_manager.ping() else "unavailable"
    except Exception:
        redis_status = "unavailable"

    try:
        async with get_db() as db:
            await db.execute(text("SELECT 1"))
        db_status = "healthy"
    except Exception:
        db_status = "unavailable"

    return {
        "status": "healthy" if db_status == "healthy" else "unhealthy",
        "timestamp": time.time(),
        "version": "2.0.0",
        "database": db_status,
        "redis": redis_status,
        "city_registry_size": len(CITY_REGISTRY),
    }


async def get_system_metrics() -> dict:
    """Return process-host CPU, memory and disk usage."""
    return {
        "cpu_usage": psutil.cpu_percent(),
        "memory_usage": psutil.virtual_memory().percent,
        "disk_usage": psutil.disk_usage("/").percent,
    }


if __name__ == "__main__":
    import asyncio

    async def _demo():
        health = await check_health()
        assert health["status"] in ("healthy", "unhealthy")
        assert health["city_registry_size"] == len(CITY_REGISTRY)

        metrics = await get_system_metrics()
        assert all(isinstance(v, (int, float)) for v in metrics.values())
        print(f"ok — db={health['database']} redis={health['redis']} cpu={metrics['cpu_usage']}%")

    asyncio.run(_demo())
