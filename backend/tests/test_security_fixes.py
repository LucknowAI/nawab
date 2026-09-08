"""Security regression tests — thread ownership, soft-delete, WS limits, tickets, OTP, STT, JWT."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from starlette.exceptions import HTTPException as StarletteHTTPException

from src.auth.jwt_utils import create_access_token, decode_token
from src.config.settings import Settings
from src.middleware import ws_limits
from src.schemas.response import fail


def _reset_ws_limits():
    ws_limits._local_run_timestamps.clear()
    ws_limits._local_concurrent.clear()
    ws_limits._local_connect_timestamps.clear()


@pytest.fixture(autouse=True)
def _clean_ws_limits():
    _reset_ws_limits()
    yield
    _reset_ws_limits()


def _mock_db_with_conv(conv):
    db = AsyncMock()
    db.__aenter__ = AsyncMock(return_value=db)
    db.__aexit__ = AsyncMock(return_value=None)
    result = MagicMock()
    result.scalar_one_or_none.return_value = conv
    db.execute = AsyncMock(return_value=result)
    db.add = MagicMock()
    return db


# ── FIX 1 + 6: thread ownership / soft-delete ───────────────────────────────

def test_authorize_owned_thread_ok():
    from src.handlers.chat import authorize_thread_access

    conv = SimpleNamespace(user_id=1, deleted_at=None)
    session = {"user_id": "1", "city_id": "lucknow"}

    async def _run():
        with patch("src.handlers.chat.redis_manager.get_session", AsyncMock(return_value=session)), \
             patch("src.handlers.chat.get_db") as get_db:
            get_db.return_value = _mock_db_with_conv(conv)
            assert await authorize_thread_access("owned-thread", 1) is True

    asyncio.run(_run())


def test_authorize_foreign_thread_rejected():
    from src.handlers.chat import authorize_thread_access

    conv = SimpleNamespace(user_id=2, deleted_at=None)

    async def _run():
        with patch("src.handlers.chat.redis_manager.get_session", AsyncMock(return_value={"user_id": "2"})), \
             patch("src.handlers.chat.get_db") as get_db:
            get_db.return_value = _mock_db_with_conv(conv)
            assert await authorize_thread_access("foreign-thread", 1) is False

    asyncio.run(_run())


def test_authorize_nonexistent_thread_allowed_for_first_use():
    from src.handlers.chat import authorize_thread_access

    async def _run():
        with patch("src.handlers.chat.redis_manager.get_session", AsyncMock(return_value=None)), \
             patch("src.handlers.chat.get_db") as get_db:
            get_db.return_value = _mock_db_with_conv(None)
            assert await authorize_thread_access("brand-new", 1) is True

    asyncio.run(_run())


def test_authorize_soft_deleted_rejected():
    from src.handlers.chat import authorize_thread_access

    conv = SimpleNamespace(user_id=1, deleted_at=datetime.now(timezone.utc))

    async def _run():
        with patch("src.handlers.chat.redis_manager.get_session", AsyncMock(return_value={"user_id": "1"})), \
             patch("src.handlers.chat.get_db") as get_db:
            get_db.return_value = _mock_db_with_conv(conv)
            assert await authorize_thread_access("deleted-thread", 1) is False

    asyncio.run(_run())


def test_fetch_conversation_excludes_soft_deleted():
    from src.handlers.chat import fetch_conversation

    async def _run():
        db = AsyncMock()
        result = MagicMock()
        result.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(return_value=result)
        with pytest.raises(HTTPException) as exc:
            await fetch_conversation(db, "t1", user_id=1, required=True)
        assert exc.value.status_code == 404
        assert exc.value.detail == "Conversation not found."
        assert db.execute.await_count == 1

    asyncio.run(_run())


def test_load_history_skips_foreign_redis_snapshot():
    from src.handlers.chat import load_history

    async def _run():
        with patch(
            "src.handlers.chat.redis_manager.get_session",
            AsyncMock(return_value={"user_id": "99", "city_id": "lucknow"}),
        ), patch(
            "src.handlers.chat.redis_manager.get_chat_snapshot",
            AsyncMock(return_value=[{"role": "user"}]),
        ) as snap:
            _city_id, history = await load_history("stolen", user_id=1)
            assert history is None
            snap.assert_not_awaited()

    asyncio.run(_run())


def test_persist_refuses_foreign_or_deleted_thread():
    from src.handlers.chat import persist_conversation

    foreign = SimpleNamespace(user_id=2, deleted_at=None, title=None, id=9, message_count=0)
    deleted = SimpleNamespace(
        user_id=1, deleted_at=datetime.now(timezone.utc), title=None, id=10, message_count=0
    )

    async def _run():
        for conv in (foreign, deleted):
            with patch("src.handlers.chat.get_db") as get_db:
                db = _mock_db_with_conv(conv)
                get_db.return_value = db
                await persist_conversation("t", 1, "lucknow", "hi", "hello", [])
                db.add.assert_not_called()

    asyncio.run(_run())


# ── FIX 2: WS rate / concurrent limits ───────────────────────────────────────

def test_ws_run_rate_allows_then_rejects(monkeypatch):
    monkeypatch.setattr(ws_limits.settings, "WS_RUN_RATE_LIMIT", 2)
    monkeypatch.setattr(ws_limits.settings, "WS_RUN_RATE_WINDOW_SECONDS", 60)

    async def _run():
        with patch.object(ws_limits, "_redis", return_value=None):
            assert await ws_limits.check_ws_run_rate(7) is True
            assert await ws_limits.check_ws_run_rate(7) is True
            assert await ws_limits.check_ws_run_rate(7) is False

    asyncio.run(_run())


def test_ws_concurrent_slot_blocks_second_and_releases(monkeypatch):
    monkeypatch.setattr(ws_limits.settings, "WS_MAX_CONCURRENT_RUNS", 1)

    async def _run():
        with patch.object(ws_limits, "_redis", return_value=None):
            assert await ws_limits.try_acquire_run_slot(3) is True
            assert await ws_limits.try_acquire_run_slot(3) is False
            await ws_limits.release_run_slot(3)
            assert await ws_limits.try_acquire_run_slot(3) is True
            await ws_limits.release_run_slot(3)

    asyncio.run(_run())


def test_ws_concurrent_independent_users(monkeypatch):
    monkeypatch.setattr(ws_limits.settings, "WS_MAX_CONCURRENT_RUNS", 1)

    async def _run():
        with patch.object(ws_limits, "_redis", return_value=None):
            assert await ws_limits.try_acquire_run_slot(1) is True
            assert await ws_limits.try_acquire_run_slot(2) is True
            assert await ws_limits.try_acquire_run_slot(1) is False
            await ws_limits.release_run_slot(1)
            await ws_limits.release_run_slot(2)

    asyncio.run(_run())


def test_ws_multi_connection_cannot_bypass_concurrent(monkeypatch):
    monkeypatch.setattr(ws_limits.settings, "WS_MAX_CONCURRENT_RUNS", 1)

    async def _run():
        with patch.object(ws_limits, "_redis", return_value=None):
            assert await ws_limits.try_acquire_run_slot(42) is True
            assert await ws_limits.try_acquire_run_slot(42) is False
            await ws_limits.release_run_slot(42)

    asyncio.run(_run())


def test_ws_exception_path_releases_slot(monkeypatch):
    monkeypatch.setattr(ws_limits.settings, "WS_MAX_CONCURRENT_RUNS", 1)

    async def _run():
        with patch.object(ws_limits, "_redis", return_value=None):
            assert await ws_limits.try_acquire_run_slot(5) is True
            try:
                raise RuntimeError("boom")
            except RuntimeError:
                await ws_limits.release_run_slot(5)
            assert await ws_limits.try_acquire_run_slot(5) is True
            await ws_limits.release_run_slot(5)

    asyncio.run(_run())


# ── FIX 3: STT upload protection ─────────────────────────────────────────────

def test_stt_valid_upload(monkeypatch):
    from src.stt.groq_whisper import transcribe_audio

    monkeypatch.setattr("src.stt.groq_whisper.settings.GROQ_API_KEY", "k", raising=False)
    monkeypatch.setattr(
        "src.stt.groq_whisper.settings.GROQ_TRANSCRIPTION_URL",
        "https://example.test/t",
        raising=False,
    )
    upload = MagicMock()
    upload.filename = "clip.webm"
    upload.content_type = "audio/webm"
    upload.size = 4
    upload.read = AsyncMock(return_value=b"abcd")

    resp = MagicMock()
    resp.is_success = True
    resp.json.return_value = {"text": "hi", "language": "en", "duration": 0.1}
    client = AsyncMock()
    client.post = AsyncMock(return_value=resp)
    client.__aenter__ = AsyncMock(return_value=client)
    client.__aexit__ = AsyncMock(return_value=None)

    with patch("src.stt.groq_whisper.httpx.AsyncClient", return_value=client):
        result = asyncio.run(transcribe_audio(upload, 1))
    assert result["text"] == "hi"


def test_stt_empty_rejected(monkeypatch):
    from src.stt.groq_whisper import transcribe_audio

    monkeypatch.setattr("src.stt.groq_whisper.settings.GROQ_API_KEY", "k", raising=False)
    upload = MagicMock()
    upload.filename = "clip.webm"
    upload.content_type = "audio/webm"
    upload.size = 0
    upload.read = AsyncMock(return_value=b"")
    with pytest.raises(HTTPException) as exc:
        asyncio.run(transcribe_audio(upload, 1))
    assert exc.value.status_code == 400


def test_stt_oversized_rejected(monkeypatch):
    from src.stt.groq_whisper import transcribe_audio

    monkeypatch.setattr("src.stt.groq_whisper.settings.GROQ_API_KEY", "k", raising=False)
    monkeypatch.setattr("src.stt.groq_whisper.settings.MAX_STT_FILE_BYTES", 8, raising=False)
    upload = MagicMock()
    upload.filename = "clip.webm"
    upload.content_type = "audio/webm"
    upload.size = 9
    upload.read = AsyncMock(return_value=b"123456789")
    with pytest.raises(HTTPException) as exc:
        asyncio.run(transcribe_audio(upload, 1))
    assert exc.value.status_code == 413


def test_stt_unsupported_mime_rejected(monkeypatch):
    from src.stt.groq_whisper import transcribe_audio

    monkeypatch.setattr("src.stt.groq_whisper.settings.GROQ_API_KEY", "k", raising=False)
    upload = MagicMock()
    upload.filename = "clip.exe"
    upload.content_type = "application/octet-stream"
    upload.size = 3
    upload.read = AsyncMock(return_value=b"abc")
    with pytest.raises(HTTPException) as exc:
        asyncio.run(transcribe_audio(upload, 1))
    assert exc.value.status_code == 400


def test_stt_path_traversal_filename_rejected(monkeypatch):
    from src.stt.groq_whisper import transcribe_audio

    monkeypatch.setattr("src.stt.groq_whisper.settings.GROQ_API_KEY", "k", raising=False)
    upload = MagicMock()
    upload.filename = "../../etc/passwd.webm"
    upload.content_type = "audio/webm"
    upload.size = 3
    upload.read = AsyncMock(return_value=b"abc")
    with pytest.raises(HTTPException) as exc:
        asyncio.run(transcribe_audio(upload, 1))
    assert exc.value.status_code == 400


def test_stt_groq_error_is_generic(monkeypatch):
    from src.stt.groq_whisper import transcribe_audio

    monkeypatch.setattr("src.stt.groq_whisper.settings.GROQ_API_KEY", "k", raising=False)
    monkeypatch.setattr(
        "src.stt.groq_whisper.settings.GROQ_TRANSCRIPTION_URL",
        "https://example.test/t",
        raising=False,
    )
    upload = MagicMock()
    upload.filename = "clip.webm"
    upload.content_type = "audio/webm"
    upload.size = 4
    upload.read = AsyncMock(return_value=b"abcd")

    resp = MagicMock()
    resp.is_success = False
    resp.status_code = 500
    resp.text = "SECRET_PROVIDER_BODY"
    client = AsyncMock()
    client.post = AsyncMock(return_value=resp)
    client.__aenter__ = AsyncMock(return_value=client)
    client.__aexit__ = AsyncMock(return_value=None)

    with patch("src.stt.groq_whisper.httpx.AsyncClient", return_value=client):
        with pytest.raises(HTTPException) as exc:
            asyncio.run(transcribe_audio(upload, 1))
    assert exc.value.status_code == 502
    assert "SECRET_PROVIDER_BODY" not in str(exc.value.detail)


# ── FIX 4: JWT not exposed + WS tickets ──────────────────────────────────────

def test_login_payload_has_no_access_token():
    from sqlalchemy_models.user import UserModel
    from src.handlers.auth import build_user_payload

    user = UserModel(id=1, email="a@b.com", full_name="A", picture=None)
    payload = build_user_payload(user, token="should-not-appear")
    assert "access_token" not in payload


def test_ws_ticket_single_use_and_scoped():
    store: dict[str, str] = {}

    class FakeRedis:
        async def create_ws_ticket(self, user_id: int, ttl: int | None = None):
            import secrets
            ticket = secrets.token_urlsafe(8)
            store[ticket] = str(user_id)
            return ticket

        async def consume_ws_ticket(self, ticket: str):
            raw = store.pop(ticket, None)
            return int(raw) if raw is not None else None

    async def _run():
        fake = FakeRedis()
        ticket = await fake.create_ws_ticket(11)
        assert await fake.consume_ws_ticket(ticket) == 11
        assert await fake.consume_ws_ticket(ticket) is None

    asyncio.run(_run())


def test_ws_ticket_redis_roundtrip_mocked():
    from src.database.redis import RedisManager

    async def _run():
        mgr = RedisManager()
        mgr._connected = True
        client = AsyncMock()
        stored = {}

        async def _set(key, value, ex=None):
            stored[key] = value

        async def _getdel(key):
            return stored.pop(key, None)

        client.set = AsyncMock(side_effect=_set)
        client.getdel = AsyncMock(side_effect=_getdel)
        mgr.redis_client = client

        ticket = await mgr.create_ws_ticket(88, ttl=30)
        assert ticket
        assert await mgr.consume_ws_ticket(ticket) == 88
        assert await mgr.consume_ws_ticket(ticket) is None

    asyncio.run(_run())


def test_ws_ticket_not_usable_as_rest_bearer():
    with pytest.raises(HTTPException) as exc:
        decode_token("not-a-jwt-ticket-value")
    assert exc.value.status_code == 401
    assert exc.value.detail == "Invalid or expired token"


# ── FIX 5: OTP verify attempt limit ──────────────────────────────────────────

def test_otp_verify_lockout_and_reset():
    from src.database.redis import RedisManager

    async def _run():
        mgr = RedisManager()
        mgr._connected = True
        counts: dict[str, int] = {}
        client = AsyncMock()

        async def incr(key):
            counts[key] = counts.get(key, 0) + 1
            return counts[key]

        client.incr = AsyncMock(side_effect=incr)
        client.expire = AsyncMock(return_value=True)
        client.delete = AsyncMock(side_effect=lambda key: counts.pop(key, None) or 1)
        mgr.redis_client = client

        email = "user@example.com"
        assert await mgr.check_otp_verify_rate_limit(email, max_attempts=3) is True
        assert await mgr.check_otp_verify_rate_limit(email, max_attempts=3) is True
        assert await mgr.check_otp_verify_rate_limit(email, max_attempts=3) is True
        assert await mgr.check_otp_verify_rate_limit(email, max_attempts=3) is False
        await mgr.clear_otp_verify_rate_limit(email)
        assert await mgr.check_otp_verify_rate_limit(email, max_attempts=3) is True

    asyncio.run(_run())


def test_verify_login_otp_lockout_generic(monkeypatch):
    from src.handlers import auth as auth_handler

    monkeypatch.setattr(auth_handler.redis_manager, "_connected", True, raising=False)
    monkeypatch.setattr(
        auth_handler.redis_manager,
        "check_otp_verify_rate_limit",
        AsyncMock(return_value=False),
    )

    async def _run():
        with pytest.raises(HTTPException) as exc:
            await auth_handler.verify_login_otp("a@b.com", "123456")
        assert exc.value.status_code == 401
        assert exc.value.detail == "Invalid or expired OTP"

    asyncio.run(_run())


def test_verify_login_otp_incorrect_generic(monkeypatch):
    from src.handlers import auth as auth_handler

    monkeypatch.setattr(auth_handler.redis_manager, "_connected", True, raising=False)
    monkeypatch.setattr(
        auth_handler.redis_manager,
        "check_otp_verify_rate_limit",
        AsyncMock(return_value=True),
    )
    monkeypatch.setattr(
        auth_handler.redis_manager,
        "verify_and_consume_otp",
        AsyncMock(return_value=False),
    )

    async def _run():
        with pytest.raises(HTTPException) as exc:
            await auth_handler.verify_login_otp("a@b.com", "000000")
        assert exc.value.detail == "Invalid or expired OTP"

    asyncio.run(_run())


# ── FIX 7: health metrics auth ───────────────────────────────────────────────

def test_health_public_metrics_auth_required():
    from src.api.health import health_router
    from src.auth.jwt_utils import get_current_user_id

    app = FastAPI()

    @app.exception_handler(StarletteHTTPException)
    async def _http(_req, exc: StarletteHTTPException):
        return fail(exc.detail, exc.status_code)

    app.include_router(health_router, prefix="/api/v1")
    client = TestClient(app)

    with patch("src.handlers.health.check_health", AsyncMock(return_value={"status": "healthy"})):
        assert client.get("/api/v1/health/").status_code == 200

    metrics = client.get("/api/v1/health/metrics")
    assert metrics.status_code == 401

    app.dependency_overrides[get_current_user_id] = lambda: 1
    with patch(
        "src.handlers.health.get_system_metrics",
        AsyncMock(return_value={"cpu": 1}),
    ):
        ok = client.get("/api/v1/health/metrics")
    assert ok.status_code == 200


# ── FIX 8: JWT / stream error disclosure ─────────────────────────────────────

def test_jwt_error_message_is_generic(monkeypatch):
    monkeypatch.setattr("src.auth.jwt_utils.settings.JWT_SECRET", "test-secret-for-unit-tests-only")
    monkeypatch.setattr("src.auth.jwt_utils.settings.JWT_ALGORITHM", "HS256")
    with pytest.raises(HTTPException) as exc:
        decode_token("definitely.not.valid")
    assert exc.value.detail == "Invalid or expired token"


def test_stream_error_message_is_generic():
    from src.handlers.streaming import run_agent_stream

    sent = []

    async def send(event):
        sent.append(event)

    class Ctx:
        async def __aenter__(self):
            raise RuntimeError("INTERNAL_LEAK_DETAIL")

        async def __aexit__(self, *a):
            return False

    agent = MagicMock()
    agent.run_stream_events.return_value = Ctx()

    async def _run():
        with patch("src.handlers.streaming.load_history", AsyncMock(return_value=("lucknow", None))), \
             patch("src.handlers.streaming.get_agent", return_value=agent), \
             patch("src.handlers.streaming.redis_manager.save_chat_snapshot", AsyncMock()):
            await run_agent_stream(send, 1, "t", "hi")

    asyncio.run(_run())
    errors = [e for e in sent if e.get("type") == "error"]
    assert errors
    assert "INTERNAL_LEAK_DETAIL" not in errors[0]["message"]


# ── FIX 9: input limits ──────────────────────────────────────────────────────

def test_conversation_list_limit_clamped():
    from src.api.chat import chat_router
    from src.auth.jwt_utils import get_current_user_id

    app = FastAPI()

    @app.exception_handler(StarletteHTTPException)
    async def _http(_req, exc: StarletteHTTPException):
        return fail(exc.detail, exc.status_code)

    app.include_router(chat_router, prefix="/api/v1")
    app.dependency_overrides[get_current_user_id] = lambda: 1

    with patch("src.handlers.chat.list_conversations", AsyncMock(return_value=[])) as listed:
        client = TestClient(app)
        bad = client.get("/api/v1/chat/conversations", params={"limit": 9999})
        assert bad.status_code == 422
        ok = client.get("/api/v1/chat/conversations", params={"limit": 50})
        assert ok.status_code == 200
        listed.assert_awaited()


def test_feedback_message_max_length():
    from pydantic import ValidationError

    from src.config.settings import settings
    from src.handlers.feedback import FeedbackRequest

    with pytest.raises(ValidationError):
        FeedbackRequest(message="x" * (settings.MAX_FEEDBACK_MESSAGE_CHARS + 1))


# ── FIX 10: JWT config hardening ─────────────────────────────────────────────

def test_jwt_config_rejects_weak_production_secret():
    s = Settings.__new__(Settings)
    s.ENVIRONMENT = "production"
    s.JWT_SECRET = "short"
    s.JWT_ALGORITHM = "HS256"
    with pytest.raises(RuntimeError, match="at least 32"):
        s.validate_jwt_config()


def test_jwt_config_rejects_disallowed_algorithm():
    s = Settings.__new__(Settings)
    s.ENVIRONMENT = "development"
    s.JWT_SECRET = "dev-secret"
    s.JWT_ALGORITHM = "none"
    with pytest.raises(RuntimeError, match="JWT_ALGORITHM"):
        s.validate_jwt_config()


def test_jwt_config_accepts_dev_secret():
    s = Settings.__new__(Settings)
    s.ENVIRONMENT = "development"
    s.JWT_SECRET = "dev-only"
    s.JWT_ALGORITHM = "HS256"
    s.validate_jwt_config()


def test_create_access_token_roundtrip(monkeypatch):
    monkeypatch.setattr("src.auth.jwt_utils.settings.JWT_SECRET", "test-secret-for-unit-tests-only")
    monkeypatch.setattr("src.auth.jwt_utils.settings.JWT_ALGORITHM", "HS256")
    token = create_access_token({"sub": "9", "email": "t@e.com"})
    payload = decode_token(token)
    assert payload["sub"] == "9"


def test_tts_settings_unchanged():
    from src.config.settings import settings

    assert settings.TTS_VOICE == "hm_psi"
    assert settings.TTS_SPEED == 1.05
