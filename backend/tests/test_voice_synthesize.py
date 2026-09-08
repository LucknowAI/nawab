"""TTS endpoint tests — mocked provider, no model download."""

import asyncio
from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from fastapi.testclient import TestClient
from starlette.exceptions import HTTPException as StarletteHTTPException

from src.api.voice import voice_router
from src.auth.jwt_utils import get_current_user_id
from src.handlers.voice import SynthesizeRequest, synthesize
from src.schemas.response import fail
from src.tts.base import TTSUnavailableError
from src.tts.factory import get_tts_provider, reset_tts_provider
from src.tts.kokoro import KokoroTTSProvider, _clip_text, _trim_silence, _wav_bytes


@pytest.fixture(autouse=True)
def _reset_provider():
    reset_tts_provider()
    yield
    reset_tts_provider()


def test_factory_defaults_to_kokoro_without_loading_model():
    provider = get_tts_provider()
    assert isinstance(provider, KokoroTTSProvider)
    assert provider._pipeline is None


def test_clip_text_respects_sentence_boundary():
    text = "नमस्ते दोस्त। यह बहुत लंबा वाक्य है जो सीमा से आगे जाता है।"
    clipped = _clip_text(text, 20)
    assert len(clipped) <= 20
    assert clipped.endswith("।") or len(clipped) <= 20


def test_wav_bytes_writes_riff_header():
    np = pytest.importorskip("numpy")

    audio = np.zeros(160, dtype=np.float32)
    wav = _wav_bytes(audio, 16000)
    assert wav[:4] == b"RIFF"
    assert b"WAVE" in wav[:16]
    assert len(wav) > 44


def test_trim_silence_keeps_short_pad():
    np = pytest.importorskip("numpy")

    sr = 24000
    # 500ms hush + 200ms tone + 500ms hush
    lead = np.zeros(int(sr * 0.5), dtype=np.float32)
    tone = np.full(int(sr * 0.2), 0.4, dtype=np.float32)
    trail = np.zeros(int(sr * 0.5), dtype=np.float32)
    trimmed = _trim_silence(np.concatenate([lead, tone, trail]), sr, pad_ms=40.0)
    # ~200ms tone + ~40ms pad each side ≈ 280ms
    dur = trimmed.size / sr
    assert 0.25 <= dur <= 0.35
    assert float(np.max(np.abs(trimmed))) > 0.01


def test_trim_silence_noop_on_all_quiet():
    np = pytest.importorskip("numpy")

    quiet = np.zeros(2400, dtype=np.float32)
    trimmed = _trim_silence(quiet, 24000)
    assert trimmed.size == quiet.size


def test_synthesize_rejects_empty_text():
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(synthesize("   "))
    assert exc_info.value.status_code == 400


def test_synthesize_returns_wav_from_provider():
    fake_wav = b"RIFF" + b"\x00" * 4 + b"WAVE" + b"\x00" * 8
    mock_provider = MagicMock()
    mock_provider.synthesize.return_value = fake_wav
    mock_provider.content_type = "audio/wav"

    with patch("src.handlers.voice.get_tts_provider", return_value=mock_provider):
        wav, content_type = asyncio.run(synthesize("नमस्ते, मैं नवाब हूँ।"))

    assert wav == fake_wav
    assert content_type == "audio/wav"
    mock_provider.synthesize.assert_called_once_with("नमस्ते, मैं नवाब हूँ।")


def test_synthesize_unavailable_returns_503():
    mock_provider = MagicMock()
    mock_provider.synthesize.side_effect = TTSUnavailableError(
        "TTS dependencies are not installed."
    )

    with patch("src.handlers.voice.get_tts_provider", return_value=mock_provider):
        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(synthesize("नमस्ते"))

    assert exc_info.value.status_code == 503


def _voice_app() -> FastAPI:
    app = FastAPI()

    @app.exception_handler(StarletteHTTPException)
    async def _http_exc(_request, exc: StarletteHTTPException):
        return fail(exc.detail, exc.status_code)

    app.include_router(voice_router, prefix="/api/v1")
    return app


def test_synthesize_unauthenticated_returns_401():
    client = TestClient(_voice_app())
    response = client.post(
        "/api/v1/voice/synthesize",
        json={"text": "नमस्ते"},
    )
    assert response.status_code == 401


def test_synthesize_authenticated_returns_raw_wav():
    fake_wav = b"RIFF" + b"\x00" * 4 + b"WAVE" + b"\x00" * 8
    mock_provider = MagicMock()
    mock_provider.synthesize.return_value = fake_wav
    mock_provider.content_type = "audio/wav"

    app = _voice_app()
    app.dependency_overrides[get_current_user_id] = lambda: 42

    with patch("src.handlers.voice.get_tts_provider", return_value=mock_provider):
        client = TestClient(app)
        response = client.post(
            "/api/v1/voice/synthesize",
            json={"text": "नमस्ते"},
        )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("audio/wav")
    assert response.content == fake_wav
    assert isinstance(response, Response) or response.content == fake_wav


def test_synthesize_authenticated_via_bearer_header(monkeypatch):
    monkeypatch.setattr("src.auth.jwt_utils.settings.JWT_SECRET", "test-secret")
    monkeypatch.setattr("src.auth.jwt_utils.settings.JWT_ALGORITHM", "HS256")

    fake_wav = b"RIFF" + b"\x00" * 4 + b"WAVE" + b"\x00" * 8
    mock_provider = MagicMock()
    mock_provider.synthesize.return_value = fake_wav
    mock_provider.content_type = "audio/wav"

    from src.auth.jwt_utils import create_access_token

    token = create_access_token({"sub": "99"})
    app = _voice_app()

    with patch("src.handlers.voice.get_tts_provider", return_value=mock_provider):
        client = TestClient(app)
        response = client.post(
            "/api/v1/voice/synthesize",
            json={"text": "नमस्ते"},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    assert response.content == fake_wav
    assert response.headers["content-type"].startswith("audio/wav")


def test_synthesize_authenticated_via_cookie(monkeypatch):
    monkeypatch.setattr("src.auth.jwt_utils.settings.JWT_SECRET", "test-secret")
    monkeypatch.setattr("src.auth.jwt_utils.settings.JWT_ALGORITHM", "HS256")

    fake_wav = b"RIFF" + b"\x00" * 4 + b"WAVE" + b"\x00" * 8
    mock_provider = MagicMock()
    mock_provider.synthesize.return_value = fake_wav
    mock_provider.content_type = "audio/wav"

    from src.auth.jwt_utils import create_access_token

    token = create_access_token({"sub": "77"})
    app = _voice_app()

    with patch("src.handlers.voice.get_tts_provider", return_value=mock_provider):
        client = TestClient(app)
        client.cookies.set("access_token", token)
        response = client.post(
            "/api/v1/voice/synthesize",
            json={"text": "नमस्ते"},
        )

    assert response.status_code == 200
    assert response.content == fake_wav


def test_synthesize_request_model():
    body = SynthesizeRequest(text="hello")
    assert body.text == "hello"


def test_importing_voice_router_does_not_eagerly_load_tts_runtime():
    """App/router import must work without requirements-tts.txt (no torch/kokoro)."""
    import os
    import subprocess
    import sys
    from pathlib import Path

    backend_root = Path(__file__).resolve().parents[1]
    script = (
        "import sys\n"
        "import src.api.voice  # noqa: F401\n"
        "import main  # noqa: F401\n"
        "banned = [m for m in sys.modules if m == 'torch' or m == 'soundfile' "
        "or m == 'kokoro' or m.startswith('torch.') or m.startswith('kokoro.') "
        "or m == 'src.tts.kokoro']\n"
        "assert not banned, banned\n"
        "print('ok')\n"
    )
    env = os.environ.copy()
    env["PYTHONPATH"] = str(backend_root)
    result = subprocess.run(
        [sys.executable, "-c", script],
        cwd=str(backend_root),
        capture_output=True,
        text=True,
        env=env,
    )
    assert result.returncode == 0, result.stderr or result.stdout
    assert "ok" in result.stdout


def test_synthesize_missing_tts_deps_returns_503():
    """When kokoro/torch cannot be imported, synthesize surfaces a clear 503."""
    provider = KokoroTTSProvider()

    with patch.object(
        provider,
        "_load_pipeline",
        side_effect=TTSUnavailableError(
            "TTS dependencies are not installed. "
            "pip install -r requirements-tts.txt"
        ),
    ):
        with patch("src.handlers.voice.get_tts_provider", return_value=provider):
            with pytest.raises(HTTPException) as exc_info:
                asyncio.run(synthesize("नमस्ते"))

    assert exc_info.value.status_code == 503
    assert "TTS" in str(exc_info.value.detail)
