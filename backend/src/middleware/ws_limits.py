"""Per-user WebSocket run rate limits and concurrent-run slots.

Prefer Redis so multiple connections / instances share the same counters.
When Redis is down, fall back to process-local state — safe for a single
instance, but not shared across replicas (documented intentionally).
"""

from __future__ import annotations

import asyncio
import time
from collections import defaultdict

from src.config.settings import settings

# Process-local fallbacks when Redis is unavailable (single-instance only).
_local_run_timestamps: dict[int, list[float]] = defaultdict(list)
_local_concurrent: dict[int, int] = defaultdict(int)
_local_connect_timestamps: dict[str, list[float]] = defaultdict(list)
_local_lock = asyncio.Lock()


def _redis():
    try:
        from src.database.redis import redis_manager
        return redis_manager
    except Exception:
        return None


async def check_ws_connect_rate(client_ip: str) -> bool:
    """True if this IP may open another WS connection. Fails open on Redis errors."""
    max_req = settings.WS_CONNECT_RATE_LIMIT
    window = settings.WS_CONNECT_RATE_WINDOW_SECONDS
    redis = _redis()
    if redis and redis.is_connected:
        try:
            key = f"{settings.CACHE_PREFIX}ws_conn_rl:{client_ip}"
            count = await redis.redis_client.incr(key)
            if count == 1:
                await redis.redis_client.expire(key, window)
            return count <= max_req
        except Exception:
            pass

    async with _local_lock:
        now = time.time()
        stamps = [t for t in _local_connect_timestamps[client_ip] if now - t < window]
        stamps.append(now)
        _local_connect_timestamps[client_ip] = stamps
        return len(stamps) <= max_req


async def check_ws_run_rate(user_id: int) -> bool:
    """True if this user may start another agent run in the rate window."""
    max_req = settings.WS_RUN_RATE_LIMIT
    window = settings.WS_RUN_RATE_WINDOW_SECONDS
    redis = _redis()
    if redis and redis.is_connected:
        try:
            key = f"{settings.CACHE_PREFIX}ws_run_rl:{user_id}"
            count = await redis.redis_client.incr(key)
            if count == 1:
                await redis.redis_client.expire(key, window)
            return count <= max_req
        except Exception:
            pass

    async with _local_lock:
        now = time.time()
        stamps = [t for t in _local_run_timestamps[user_id] if now - t < window]
        stamps.append(now)
        _local_run_timestamps[user_id] = stamps
        return len(stamps) <= max_req


async def try_acquire_run_slot(user_id: int) -> bool:
    """Acquire one concurrent expensive-run slot for the user. False if at cap."""
    max_concurrent = settings.WS_MAX_CONCURRENT_RUNS
    redis = _redis()
    if redis and redis.is_connected:
        try:
            key = f"{settings.CACHE_PREFIX}ws_run_active:{user_id}"
            count = await redis.redis_client.incr(key)
            # Soft TTL so a crashed process cannot hold the slot forever.
            await redis.redis_client.expire(key, max(300, settings.SESSION_TIMEOUT))
            if count > max_concurrent:
                await redis.redis_client.decr(key)
                return False
            return True
        except Exception:
            pass

    async with _local_lock:
        if _local_concurrent[user_id] >= max_concurrent:
            return False
        _local_concurrent[user_id] += 1
        return True


async def release_run_slot(user_id: int) -> None:
    """Release a previously acquired concurrent-run slot."""
    redis = _redis()
    if redis and redis.is_connected:
        try:
            key = f"{settings.CACHE_PREFIX}ws_run_active:{user_id}"
            count = await redis.redis_client.decr(key)
            if count <= 0:
                await redis.redis_client.delete(key)
            return
        except Exception:
            pass

    async with _local_lock:
        if _local_concurrent[user_id] > 0:
            _local_concurrent[user_id] -= 1
