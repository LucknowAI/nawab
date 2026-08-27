"""Redis cache: chat session metadata, conversation snapshots, and OTPs.

Every operation degrades gracefully when Redis is down — reads return None/[]
and writes return False, so callers fall back to Postgres instead of failing.
"""

import hmac
import json
import logging
from datetime import datetime, timezone

import redis.asyncio as redis

from src.config.settings import settings

logger = logging.getLogger(__name__)


class RedisManager:
    """Owns the Redis connection and every key this app reads or writes."""

    def __init__(self):
        self.redis_client = None
        self._connected = False

    async def connect(self) -> None:
        """Open the connection and verify it with a ping."""
        try:
            self.redis_client = redis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
                socket_keepalive=True,
                health_check_interval=30,
                retry_on_timeout=True,
            )
            await self.redis_client.ping()
            self._connected = True
            logger.info("Connected to Redis")
        except redis.ConnectionError as e:
            logger.warning(f"Redis unavailable ({e}) — falling back to the database")
            self._connected = False
        except Exception as e:
            logger.error(f"Unexpected Redis error: {e}")
            self._connected = False

    async def disconnect(self) -> None:
        """Close the connection."""
        if self.redis_client:
            await self.redis_client.close()
            self._connected = False
            logger.info("Disconnected from Redis")

    @property
    def is_connected(self) -> bool:
        return self._connected

    async def ping(self) -> bool:
        """Live check for the health endpoint — the connection may have dropped."""
        if not self.redis_client:
            return False
        try:
            await self.redis_client.ping()
            return True
        except Exception:
            self._connected = False
            return False

    # ── Session metadata ────────────────────────────────────────────────────

    async def cache_session(self, session_id: str, user_id: str, data: dict = None) -> bool:
        """Store session metadata (city_id, owner) under a TTL."""
        if not self._connected:
            return False
        try:
            payload = {
                "session_id": session_id,
                "user_id": user_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
                **(data or {}),
            }
            await self.redis_client.set(
                f"{settings.CACHE_PREFIX}session:{session_id}",
                json.dumps(payload),
                ex=settings.SESSION_TIMEOUT,
            )
            return True
        except Exception as e:
            logger.error(f"Error caching session {session_id}: {e}")
            return False

    async def get_session(self, session_id: str) -> dict | None:
        """Return cached session metadata, or None if absent or unparseable."""
        if not self._connected:
            return None
        try:
            data = await self.redis_client.get(f"{settings.CACHE_PREFIX}session:{session_id}")
            return json.loads(data) if data else None
        except Exception as e:
            logger.error(f"Error retrieving session {session_id}: {e}")
            return None

    # ── Chat snapshot (pydantic-ai ModelMessage list) ───────────────────────

    async def save_chat_snapshot(self, thread_id: str, messages: list) -> bool:
        """Cache a conversation's full message list so history loads skip the DB."""
        if not self._connected:
            return False
        try:
            await self.redis_client.set(
                f"{settings.CACHE_PREFIX}chat:{thread_id}:snapshot",
                json.dumps(messages, default=str),
                ex=settings.SESSION_TIMEOUT,
            )
            return True
        except Exception as e:
            logger.error(f"Error saving chat snapshot for {thread_id}: {e}")
            return False

    async def get_chat_snapshot(self, thread_id: str) -> list | None:
        """Return the cached message list for a conversation, or None."""
        if not self._connected:
            return None
        try:
            data = await self.redis_client.get(f"{settings.CACHE_PREFIX}chat:{thread_id}:snapshot")
            return json.loads(data) if data else None
        except Exception as e:
            logger.error(f"Error loading chat snapshot for {thread_id}: {e}")
            return None

    # ── OTP ─────────────────────────────────────────────────────────────────

    async def save_otp(self, email: str, otp: str, ttl: int = 120) -> bool:
        """Store a login OTP that expires after *ttl* seconds."""
        if not self._connected:
            return False
        try:
            await self.redis_client.set(f"{settings.CACHE_PREFIX}otp:{email}", otp, ex=ttl)
            return True
        except Exception as e:
            logger.error(f"Error saving OTP for {email!r}: {e}")
            return False

    async def verify_and_consume_otp(self, email: str, otp: str) -> bool:
        """Compare in constant time, then delete on match so it can't be replayed."""
        if not self._connected:
            return False
        try:
            key = f"{settings.CACHE_PREFIX}otp:{email}"
            stored = await self.redis_client.get(key)
            if stored is None:
                return False
            if hmac.compare_digest(stored.strip(), otp.strip()):
                await self.redis_client.delete(key)
                return True
            return False
        except Exception as e:
            logger.error(f"Error verifying OTP for {email!r}: {e}")
            return False

    async def check_otp_rate_limit(
        self, email: str, max_requests: int = 3, window_seconds: int = 600
    ) -> bool:
        """True if this email may request another OTP. Fails open when Redis is down."""
        if not self._connected:
            return True
        try:
            key = f"{settings.CACHE_PREFIX}otp_rl:{email}"
            count = await self.redis_client.incr(key)
            if count == 1:
                await self.redis_client.expire(key, window_seconds)
            return count <= max_requests
        except Exception as e:
            logger.error(f"Error checking OTP rate limit for {email!r}: {e}")
            return True


redis_manager = RedisManager()
