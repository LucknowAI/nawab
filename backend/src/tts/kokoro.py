"""Kokoro-82M TTS provider (hexgrad/Kokoro-82M) with Hindi (lang_code=h).

Loaded lazily on first synthesize() so the rest of the API can start without
torch/weights. Requires system espeak-ng for Hindi G2P. No startup warmup.
"""

from __future__ import annotations

import io
import os
import threading
import time
from typing import Any

from src.config.settings import settings
from src.tts.base import TTSProvider, TTSUnavailableError
from src.utils.util_logger.logger import logger

_SAMPLE_RATE = 24000
_DEFAULT_VOICE = "hm_psi"
_DEFAULT_REPO = "hexgrad/Kokoro-82M"
_DEFAULT_LANG = "h"
_SPLIT_PATTERN = r"[।\n]+"


class KokoroTTSProvider(TTSProvider):
    content_type = "audio/wav"

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._pipeline: Any = None
        self._device: str | None = None
        self._voice: str = (settings.TTS_VOICE or _DEFAULT_VOICE).strip() or _DEFAULT_VOICE
        self._lang_code: str = (
            settings.TTS_LANG_CODE or _DEFAULT_LANG
        ).strip() or _DEFAULT_LANG
        self._repo_id: str = (
            settings.TTS_MODEL_ID or _DEFAULT_REPO
        ).strip() or _DEFAULT_REPO
        self._speed: float = float(settings.TTS_SPEED or 1.0)
        self._sample_rate: int = _SAMPLE_RATE

    def synthesize(self, text: str) -> bytes:
        """One-shot WAV from full text (all Kokoro chunks concatenated)."""
        prompt = self._prepare_prompt(text)
        self._ensure_loaded()
        assert self._pipeline is not None

        t_all = time.perf_counter()
        chunks: list[Any] = []
        try:
            with self._lock:
                t_gen = time.perf_counter()
                for _gs, _ps, audio in self._pipeline(
                    prompt,
                    voice=self._voice,
                    speed=self._speed,
                    split_pattern=_SPLIT_PATTERN,
                ):
                    chunks.append(audio)
                gen_s = time.perf_counter() - t_gen
        except Exception as exc:
            logger.exception("[tts] Kokoro generate() failed: %s", exc)
            raise RuntimeError("Speech synthesis failed.") from exc

        if not chunks:
            raise RuntimeError("Speech synthesis produced no audio.")

        t_wav = time.perf_counter()
        import numpy as np

        audio = np.concatenate(
            [np.asarray(c, dtype=np.float32).reshape(-1) for c in chunks]
        )
        # Kokoro WAVs often carry ~0.4–0.6s of lead/trail hush; across
        # sentence chunks that stacks into a ~1–2s dead gap. Trim hard edges
        # but keep a short pad so consecutive sentences still sound natural.
        audio = _trim_silence(audio, self._sample_rate)
        wav = _wav_bytes(audio, self._sample_rate)
        wav_s = time.perf_counter() - t_wav
        dur = float(audio.shape[0]) / float(self._sample_rate)
        logger.info(
            "[tts] synthesize device=%s voice=%s chars=%s gen_s=%.3f wav_s=%.3f "
            "audio_s=%.2f rtf=%.2f total_s=%.3f",
            self._device,
            self._voice,
            len(prompt),
            gen_s,
            wav_s,
            dur,
            gen_s / max(dur, 1e-6),
            time.perf_counter() - t_all,
        )
        return wav

    def _prepare_prompt(self, text: str) -> str:
        prompt = (text or "").strip()
        if not prompt:
            raise ValueError("TTS text is empty.")
        max_chars = int(settings.TTS_MAX_CHARS or 500)
        if len(prompt) > max_chars:
            logger.warning(
                "[tts] Truncating prompt from %s to %s chars",
                len(prompt),
                max_chars,
            )
            prompt = _clip_text(prompt, max_chars)
        return prompt

    def _ensure_loaded(self) -> None:
        if self._pipeline is not None:
            return
        with self._lock:
            if self._pipeline is not None:
                return
            self._load_pipeline()

    def _load_pipeline(self) -> None:
        requested = (settings.TTS_DEVICE or "auto").strip().lower()
        try:
            import torch
            from kokoro import KPipeline
        except ImportError as exc:
            logger.error(
                "[tts] Missing TTS dependency: %s. Install with: "
                "pip install -r requirements-tts.txt "
                "and apt/brew install espeak-ng",
                exc,
            )
            raise TTSUnavailableError(
                "TTS dependencies are not installed. "
                "pip install -r requirements-tts.txt"
            ) from exc

        device = _resolve_device(torch, requested)
        if device == "mps":
            os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")

        logger.info(
            "[tts] Loading Kokoro model=%s lang=%s voice=%s device=%s "
            "(first call downloads weights)",
            self._repo_id,
            self._lang_code,
            self._voice,
            device,
        )

        try:
            pipeline = KPipeline(
                lang_code=self._lang_code,
                repo_id=self._repo_id,
                device=device,
            )
        except Exception as exc:
            if device != "cpu":
                logger.warning(
                    "[tts] Kokoro load on %s failed (%s); retrying on cpu",
                    device,
                    exc,
                )
                try:
                    pipeline = KPipeline(
                        lang_code=self._lang_code,
                        repo_id=self._repo_id,
                        device="cpu",
                    )
                    device = "cpu"
                except Exception as cpu_exc:
                    logger.exception("[tts] Failed to load Kokoro: %s", cpu_exc)
                    raise TTSUnavailableError(
                        "Failed to load Kokoro TTS. Check kokoro/torch install "
                        "and that espeak-ng is available."
                    ) from cpu_exc
            else:
                logger.exception("[tts] Failed to load Kokoro: %s", exc)
                raise TTSUnavailableError(
                    "Failed to load Kokoro TTS. Check kokoro/torch install "
                    "and that espeak-ng is available."
                ) from exc

        self._pipeline = pipeline
        self._device = device
        if device == "cpu":
            logger.info("[tts] Running on CPU — inference is slower than CUDA/MPS.")
        else:
            logger.info("[tts] Kokoro ready on %s voice=%s", device, self._voice)


def _resolve_device(torch: Any, requested: str) -> str:
    if requested and requested not in ("auto",):
        return requested
    if torch.cuda.is_available():
        return "cuda"
    mps = getattr(torch.backends, "mps", None)
    if mps is not None and mps.is_available():
        return "mps"
    return "cpu"


def _clip_text(text: str, max_chars: int) -> str:
    clipped = text[:max_chars]
    for sep in ("।", ".", "?", "!", ",", " ", "\n"):
        idx = clipped.rfind(sep)
        if idx >= max_chars // 2:
            return clipped[: idx + 1].strip()
    return clipped.strip()


def _trim_silence(
    audio: Any,
    sample_rate: int,
    *,
    threshold: float = 0.01,
    pad_ms: float = 40.0,
) -> Any:
    """Strip long leading/trailing hush; leave a brief natural pad."""
    import numpy as np

    arr = np.asarray(audio, dtype=np.float32).reshape(-1)
    if arr.size == 0:
        return arr
    loud = np.where(np.abs(arr) > threshold)[0]
    if loud.size == 0:
        return arr
    pad = max(0, int(sample_rate * (pad_ms / 1000.0)))
    start = max(0, int(loud[0]) - pad)
    end = min(arr.size, int(loud[-1]) + 1 + pad)
    return arr[start:end]


def _wav_bytes(audio: Any, sample_rate: int) -> bytes:
    import numpy as np

    arr = np.asarray(audio, dtype=np.float32).squeeze()
    if arr.ndim == 0:
        arr = np.array([float(arr)], dtype=np.float32)
    if arr.ndim > 1:
        arr = arr[0]
    arr = np.clip(arr, -1.0, 1.0)

    buf = io.BytesIO()
    try:
        import soundfile as sf

        sf.write(buf, arr, sample_rate, format="WAV")
        return buf.getvalue()
    except Exception:
        import wave

        pcm_i16 = (arr * 32767.0).astype(np.int16)
        with wave.open(buf, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(int(sample_rate))
            wf.writeframes(pcm_i16.tobytes())
        return buf.getvalue()
