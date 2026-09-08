"""Resolve the configured TTS provider. Single provider: Kokoro-82M."""

from __future__ import annotations

import threading

from src.config.settings import settings
from src.tts.base import TTSProvider, TTSUnavailableError

_provider: TTSProvider | None = None
_lock = threading.Lock()


def get_tts_provider() -> TTSProvider:
    global _provider
    if _provider is not None:
        return _provider
    with _lock:
        if _provider is not None:
            return _provider
        name = (settings.TTS_PROVIDER or "kokoro").strip().lower().replace("-", "_")
        if name in ("kokoro", "kokoro_82m", "kokoro82m"):
            from src.tts.kokoro import KokoroTTSProvider

            _provider = KokoroTTSProvider()
            return _provider
        raise TTSUnavailableError(
            f"Unknown TTS provider {name!r}. Set TTS_PROVIDER=kokoro."
        )


def reset_tts_provider() -> None:
    """Test helper — drop the singleton."""
    global _provider
    with _lock:
        _provider = None
