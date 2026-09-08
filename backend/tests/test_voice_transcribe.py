"""STT transcription tests — mocked Groq HTTP, no real network."""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI, UploadFile
from fastapi.testclient import TestClient

from src.api.voice import voice_router
from src.auth.jwt_utils import get_current_user_id
from src.handlers import voice as voice_handler
from src.schemas.response import fail
from src.stt.groq_whisper import _is_urdu_language, transcribe_audio
from starlette.exceptions import HTTPException as StarletteHTTPException


def _mock_upload(content: bytes = b"fake-audio") -> UploadFile:
    upload = MagicMock(spec=UploadFile)
    upload.filename = "clip.webm"
    upload.content_type = "audio/webm"
    upload.read = AsyncMock(return_value=content)
    return upload


def _groq_response(text: str, language: str, duration: float = 1.2) -> MagicMock:
    response = MagicMock()
    response.is_success = True
    response.status_code = 200
    response.json.return_value = {
        "text": text,
        "language": language,
        "duration": duration,
    }
    return response


@pytest.mark.parametrize(
    "language,expected",
    [
        ("ur", True),
        ("UR", True),
        ("Urdu", True),
        ("urdu", True),
        ("en", False),
        ("hi", False),
        ("unknown", False),
        (None, False),
    ],
)
def test_is_urdu_language(language, expected):
    assert _is_urdu_language(language) is expected


def test_transcribe_english_no_retry(monkeypatch):
    monkeypatch.setattr(
        "src.stt.groq_whisper.settings.GROQ_API_KEY", "test-key", raising=False
    )
    monkeypatch.setattr(
        "src.stt.groq_whisper.settings.GROQ_TRANSCRIPTION_URL",
        "https://example.test/transcriptions",
        raising=False,
    )

    client = AsyncMock()
    client.post = AsyncMock(return_value=_groq_response("Hello there", "en"))
    client.__aenter__ = AsyncMock(return_value=client)
    client.__aexit__ = AsyncMock(return_value=None)

    with patch("src.stt.groq_whisper.httpx.AsyncClient", return_value=client):
        result = asyncio.run(transcribe_audio(_mock_upload(), user_id=1))

    assert client.post.await_count == 1
    call_kwargs = client.post.await_args.kwargs
    assert "language" not in call_kwargs["data"]
    assert call_kwargs["data"]["temperature"] == "0"
    assert result["text"] == "Hello there"
    assert result["language"] == "en"
    assert result["provider"] == "groq"
    assert "duration_ms" in result
    assert set(result.keys()) == {"text", "language", "provider", "duration_ms"}


def test_transcribe_hindi_no_retry(monkeypatch):
    monkeypatch.setattr(
        "src.stt.groq_whisper.settings.GROQ_API_KEY", "test-key", raising=False
    )
    monkeypatch.setattr(
        "src.stt.groq_whisper.settings.GROQ_TRANSCRIPTION_URL",
        "https://example.test/transcriptions",
        raising=False,
    )

    client = AsyncMock()
    client.post = AsyncMock(return_value=_groq_response("नमस्ते", "hi"))
    client.__aenter__ = AsyncMock(return_value=client)
    client.__aexit__ = AsyncMock(return_value=None)

    with patch("src.stt.groq_whisper.httpx.AsyncClient", return_value=client):
        result = asyncio.run(transcribe_audio(_mock_upload(), user_id=1))

    assert client.post.await_count == 1
    assert "language" not in client.post.await_args.kwargs["data"]
    assert result["text"] == "नमस्ते"
    assert result["language"] == "hi"
    assert set(result.keys()) == {"text", "language", "provider", "duration_ms"}


def test_transcribe_urdu_retries_once_with_hi(monkeypatch):
    monkeypatch.setattr(
        "src.stt.groq_whisper.settings.GROQ_API_KEY", "test-key", raising=False
    )
    monkeypatch.setattr(
        "src.stt.groq_whisper.settings.GROQ_TRANSCRIPTION_URL",
        "https://example.test/transcriptions",
        raising=False,
    )

    first = _groq_response("اردو متن", "ur")
    second = _groq_response("हिंदी टेक्स्ट", "hi", duration=1.5)

    client = AsyncMock()
    client.post = AsyncMock(side_effect=[first, second])
    client.__aenter__ = AsyncMock(return_value=client)
    client.__aexit__ = AsyncMock(return_value=None)

    with patch("src.stt.groq_whisper.httpx.AsyncClient", return_value=client):
        result = asyncio.run(transcribe_audio(_mock_upload(), user_id=1))

    assert client.post.await_count == 2

    first_data = client.post.await_args_list[0].kwargs["data"]
    second_data = client.post.await_args_list[1].kwargs["data"]
    assert "language" not in first_data
    assert second_data["language"] == "hi"
    assert second_data["model"] == first_data["model"]
    assert second_data["temperature"] == "0"

    assert (
        client.post.await_args_list[0].kwargs["files"]
        == client.post.await_args_list[1].kwargs["files"]
    )

    assert result["text"] == "हिंदी टेक्स्ट"
    assert result["language"] == "hi"
    assert result["provider"] == "groq"
    assert set(result.keys()) == {"text", "language", "provider", "duration_ms"}


def test_transcribe_urdu_verbose_name_retries_once(monkeypatch):
    monkeypatch.setattr(
        "src.stt.groq_whisper.settings.GROQ_API_KEY", "test-key", raising=False
    )
    monkeypatch.setattr(
        "src.stt.groq_whisper.settings.GROQ_TRANSCRIPTION_URL",
        "https://example.test/transcriptions",
        raising=False,
    )

    client = AsyncMock()
    client.post = AsyncMock(
        side_effect=[
            _groq_response("اردو", "Urdu"),
            _groq_response("कैसे हो", "hi"),
        ]
    )
    client.__aenter__ = AsyncMock(return_value=client)
    client.__aexit__ = AsyncMock(return_value=None)

    with patch("src.stt.groq_whisper.httpx.AsyncClient", return_value=client):
        result = asyncio.run(transcribe_audio(_mock_upload(), user_id=1))

    assert client.post.await_count == 2
    assert client.post.await_args_list[1].kwargs["data"]["language"] == "hi"
    assert result["text"] == "कैसे हो"
    assert result["language"] == "hi"


def _voice_app() -> FastAPI:
    app = FastAPI()

    @app.exception_handler(StarletteHTTPException)
    async def _http_exc(_request, exc: StarletteHTTPException):
        return fail(exc.detail, exc.status_code)

    app.include_router(voice_router, prefix="/api/v1")
    return app


def test_transcribe_unauthenticated_returns_401():
    client = TestClient(_voice_app())
    response = client.post(
        "/api/v1/voice/transcribe",
        files={"file": ("clip.webm", b"fake-audio", "audio/webm")},
    )
    assert response.status_code == 401


def test_transcribe_authenticated_returns_ok_envelope(monkeypatch):
    monkeypatch.setattr(
        "src.stt.groq_whisper.settings.GROQ_API_KEY", "test-key", raising=False
    )
    monkeypatch.setattr(
        "src.stt.groq_whisper.settings.GROQ_TRANSCRIPTION_URL",
        "https://example.test/transcriptions",
        raising=False,
    )

    groq = AsyncMock()
    groq.post = AsyncMock(return_value=_groq_response("Hello auth", "en"))
    groq.__aenter__ = AsyncMock(return_value=groq)
    groq.__aexit__ = AsyncMock(return_value=None)

    app = _voice_app()
    app.dependency_overrides[get_current_user_id] = lambda: 42

    with patch("src.stt.groq_whisper.httpx.AsyncClient", return_value=groq):
        client = TestClient(app)
        response = client.post(
            "/api/v1/voice/transcribe",
            files={"file": ("clip.webm", b"fake-audio", "audio/webm")},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["message"]["text"] == "Hello auth"
    assert body["message"]["language"] == "en"
    assert body["message"]["provider"] == "groq"


def test_transcribe_authenticated_via_cookie(monkeypatch):
    monkeypatch.setattr("src.auth.jwt_utils.settings.JWT_SECRET", "test-secret")
    monkeypatch.setattr("src.auth.jwt_utils.settings.JWT_ALGORITHM", "HS256")

    from src.auth.jwt_utils import create_access_token

    token = create_access_token({"sub": "55"})

    groq = AsyncMock()
    groq.post = AsyncMock(return_value=_groq_response("cookie auth", "en"))
    groq.__aenter__ = AsyncMock(return_value=groq)
    groq.__aexit__ = AsyncMock(return_value=None)

    import src.stt.groq_whisper as gw

    with patch.object(gw.settings, "GROQ_API_KEY", "test-key"), \
         patch.object(gw.settings, "GROQ_TRANSCRIPTION_URL", "https://example.test/transcriptions"), \
         patch("src.stt.groq_whisper.httpx.AsyncClient", return_value=groq):
        client = TestClient(_voice_app())
        client.cookies.set("access_token", token)
        response = client.post(
            "/api/v1/voice/transcribe",
            files={"file": ("clip.webm", b"fake-audio", "audio/webm")},
        )

    assert response.status_code == 200
    assert response.json()["success"] is True
    assert response.json()["message"]["text"] == "cookie auth"


def test_transcribe_authenticated_via_bearer_header(monkeypatch):
    monkeypatch.setattr("src.auth.jwt_utils.settings.JWT_SECRET", "test-secret")
    monkeypatch.setattr("src.auth.jwt_utils.settings.JWT_ALGORITHM", "HS256")

    from src.auth.jwt_utils import create_access_token

    token = create_access_token({"sub": "56"})

    groq = AsyncMock()
    groq.post = AsyncMock(return_value=_groq_response("bearer auth", "en"))
    groq.__aenter__ = AsyncMock(return_value=groq)
    groq.__aexit__ = AsyncMock(return_value=None)

    import src.stt.groq_whisper as gw

    with patch.object(gw.settings, "GROQ_API_KEY", "test-key"), \
         patch.object(gw.settings, "GROQ_TRANSCRIPTION_URL", "https://example.test/transcriptions"), \
         patch("src.stt.groq_whisper.httpx.AsyncClient", return_value=groq):
        client = TestClient(_voice_app())
        response = client.post(
            "/api/v1/voice/transcribe",
            files={"file": ("clip.webm", b"fake-audio", "audio/webm")},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    assert response.json()["success"] is True
    assert response.json()["message"]["text"] == "bearer auth"


def test_handler_transcribe_delegates(monkeypatch):
    monkeypatch.setattr(
        "src.stt.groq_whisper.settings.GROQ_API_KEY", "test-key", raising=False
    )
    monkeypatch.setattr(
        "src.stt.groq_whisper.settings.GROQ_TRANSCRIPTION_URL",
        "https://example.test/transcriptions",
        raising=False,
    )
    client = AsyncMock()
    client.post = AsyncMock(return_value=_groq_response("via handler", "en"))
    client.__aenter__ = AsyncMock(return_value=client)
    client.__aexit__ = AsyncMock(return_value=None)

    with patch("src.stt.groq_whisper.httpx.AsyncClient", return_value=client):
        result = asyncio.run(voice_handler.transcribe(_mock_upload(), user_id=7))

    assert result["text"] == "via handler"
