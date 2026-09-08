"""Swap-friendly TTS provider contract.

Business logic (voice routes) should depend only on this interface so the TTS
backend can be replaced without touching call sites.
"""

from abc import ABC, abstractmethod


class TTSUnavailableError(RuntimeError):
    """Raised when the TTS backend cannot be used (missing deps, load failure)."""


class TTSProvider(ABC):
    content_type: str = "audio/wav"

    @abstractmethod
    def synthesize(self, text: str) -> bytes:
        """Turn text into audio bytes (WAV). Never call an LLM from here."""
        raise NotImplementedError
