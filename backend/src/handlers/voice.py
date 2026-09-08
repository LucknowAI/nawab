"""Voice handlers — STT transcription and TTS synthesis."""

import asyncio

from fastapi import HTTPException, UploadFile
from pydantic import BaseModel, Field

from src.stt.groq_whisper import transcribe_audio as groq_transcribe_audio
from src.tts import TTSUnavailableError, get_tts_provider
from src.utils.util_logger.logger import logger


class SynthesizeRequest(BaseModel):
    text: str = Field(..., description="Final assistant reply text to speak")


async def transcribe(file: UploadFile, user_id: int) -> dict:
    """Transcribe an uploaded audio clip via Groq Whisper."""
    return await groq_transcribe_audio(file, user_id)


async def synthesize(text: str) -> tuple[bytes, str]:
    """Return (wav_bytes, content_type) for the given text.

    Failures here must never affect text chat — the client treats TTS errors
    as non-fatal. The model is loaded lazily on the first successful call.
    """
    cleaned = (text or "").strip()
    if not cleaned:
        raise HTTPException(status_code=400, detail="Text is empty.")

    try:
        provider = get_tts_provider()
    except TTSUnavailableError as exc:
        logger.error(f"[voice] TTS provider unavailable: {exc}")
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    try:
        wav_bytes = await asyncio.to_thread(provider.synthesize, cleaned)
    except TTSUnavailableError as exc:
        logger.error(f"[voice] TTS unavailable: {exc}")
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception(f"[voice] TTS synthesis failed: {exc}")
        raise HTTPException(
            status_code=500,
            detail="Speech synthesis failed.",
        ) from exc

    if not wav_bytes:
        raise HTTPException(status_code=500, detail="Speech synthesis produced no audio.")

    content_type = getattr(provider, "content_type", "audio/wav")
    return wav_bytes, content_type
