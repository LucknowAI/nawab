"""Groq Whisper STT — language-agnostic first pass with one Hindi retry on Urdu."""

import os
import time

import httpx
from fastapi import HTTPException, UploadFile

from src.config.settings import settings
from src.utils.util_logger.logger import logger

_WHISPER_PROMPT = (
    "लखनऊ, वाराणसी, कानपुर, अवध, अवधी, भोजपुरी, हिंदी, हिंदुस्तानी, भैया, कैसे हो, कहाँ है, "
    "कितना है, आज, मौसम, हजरतगंज, गोमती नगर, चौक, अमीनाबाद, मेट्रो, एयरपोर्ट, kebab, metro, "
    "airport, Lucknow, Hazratganj, Gomti Nagar, Hinglish"
)

# Matches frontend MediaRecorder output (VoiceRecorderButton: audio/webm | audio/mp4).
_ALLOWED_STT_MIME_TYPES = frozenset({
    "audio/webm",
    "audio/mp4",
    "audio/mpeg",
    "audio/wav",
    "audio/x-wav",
    "audio/wave",
    "audio/ogg",
    "video/webm",  # some browsers label webm audio this way
})

_ALLOWED_STT_EXTENSIONS = frozenset({".webm", ".mp4", ".m4a", ".mp3", ".wav", ".ogg"})


def _is_urdu_language(language: str | None) -> bool:
    """True when Whisper reports Urdu as ISO code or verbose language name."""
    normalized = (language or "").strip().lower()
    return normalized in {"ur", "urdu"}


def _safe_filename(filename: str | None) -> str:
    """Return a basename-only filename; reject path traversal attempts."""
    raw = (filename or "").strip() or "recording.webm"
    # Disallow absolute paths and parent-directory segments.
    if "\x00" in raw or raw.startswith(("/", "\\")) or ".." in raw.replace("\\", "/").split("/"):
        raise HTTPException(status_code=400, detail="Invalid audio file upload.")
    name = os.path.basename(raw.replace("\\", "/"))
    if not name or name in {".", ".."}:
        raise HTTPException(status_code=400, detail="Invalid audio file upload.")
    ext = os.path.splitext(name)[1].lower()
    if ext and ext not in _ALLOWED_STT_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Unsupported audio format.")
    return name


def _normalize_mime(content_type: str | None) -> str:
    if not content_type:
        return ""
    return content_type.split(";", 1)[0].strip().lower()


async def _read_upload_capped(file: UploadFile, max_bytes: int) -> bytes:
    """Read at most max_bytes+1 so oversized uploads never fully buffer in memory."""
    declared = getattr(file, "size", None)
    if isinstance(declared, int) and declared > max_bytes:
        raise HTTPException(status_code=413, detail="Audio file is too large.")

    content = await file.read(max_bytes + 1)
    if len(content) > max_bytes:
        raise HTTPException(status_code=413, detail="Audio file is too large.")
    return content


async def transcribe_audio(file: UploadFile, user_id: int) -> dict:
    """
    Accepts an audio file upload, transcribes it using Groq's Whisper API,
    and returns the transcribed text and metadata.
    """
    del user_id  # reserved for future per-user quotas/audit
    if not settings.GROQ_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="GROQ_API_KEY is not configured on the backend.",
        )

    mime = _normalize_mime(file.content_type)
    if mime and mime not in _ALLOWED_STT_MIME_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported audio format.")

    safe_name = _safe_filename(file.filename)
    # If Content-Type was omitted, require a known extension.
    if not mime:
        ext = os.path.splitext(safe_name)[1].lower()
        if ext not in _ALLOWED_STT_EXTENSIONS:
            raise HTTPException(status_code=400, detail="Unsupported audio format.")
        mime = "audio/webm" if ext == ".webm" else "audio/mp4"

    try:
        content = await _read_upload_capped(file, settings.MAX_STT_FILE_BYTES)
        if not content:
            raise HTTPException(status_code=400, detail="Empty audio recording.")
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"[voice] Failed to read uploaded audio file: {exc}")
        raise HTTPException(status_code=400, detail="Invalid audio file upload.") from exc

    files = {
        "file": (safe_name, content, mime),
    }

    # First pass is language-agnostic so English can detect as en.
    data = {
        "model": "whisper-large-v3",
        "prompt": _WHISPER_PROMPT,
        "response_format": "verbose_json",
        "temperature": "0",
    }

    headers = {"Authorization": f"Bearer {settings.GROQ_API_KEY}"}
    start_time = time.time()

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                settings.GROQ_TRANSCRIPTION_URL,
                headers=headers,
                data=data,
                files=files,
            )

            if not response.is_success:
                logger.error(
                    f"[voice] Groq API transcription failed: "
                    f"status={response.status_code} body={response.text}"
                )
                raise HTTPException(
                    status_code=502,
                    detail="Transcription failed. Please try again.",
                )

            result = response.json()
            transcript = result.get("text", "").strip()
            language = result.get("language", "unknown")
            duration = result.get("duration", 0.0)

            # Urdu mis-detect of Hindi/Hinglish: one Hindi-forced retry only.
            if _is_urdu_language(language):
                logger.info(
                    "[voice] Whisper detected Urdu; retrying transcription with language=hi"
                )
                retry_data = {**data, "language": "hi"}
                retry_response = await client.post(
                    settings.GROQ_TRANSCRIPTION_URL,
                    headers=headers,
                    data=retry_data,
                    files=files,
                )
                if not retry_response.is_success:
                    logger.error(
                        f"[voice] Groq API Hindi retry failed: "
                        f"status={retry_response.status_code} body={retry_response.text}"
                    )
                    raise HTTPException(
                        status_code=502,
                        detail="Transcription failed. Please try again.",
                    )
                result = retry_response.json()
                transcript = result.get("text", "").strip()
                language = result.get("language", "hi")
                duration = result.get("duration", duration)

        duration_ms = int((time.time() - start_time) * 1000)
        logger.info(
            f"[voice] Transcribed language={language} duration_sec={duration} "
            f"in duration_ms={duration_ms}ms"
        )

        return {
            "text": transcript,
            "language": language,
            "provider": "groq",
            "duration_ms": duration_ms,
        }

    except httpx.RequestError as exc:
        logger.error(f"[voice] Network error while contacting Groq: {exc}")
        raise HTTPException(
            status_code=503,
            detail="Transcription service is currently unreachable.",
        ) from exc
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(f"[voice] Unexpected transcription failure: {exc}")
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred during transcription.",
        ) from exc
