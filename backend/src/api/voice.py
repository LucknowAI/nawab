"""Voice REST routes — STT and TTS.

Transcribe returns the monorepo `ok()` envelope. Synthesize returns raw WAV
bytes (not enveloped) so the client can play audio directly.
"""

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import Response

from src.auth.jwt_utils import get_current_user_id
from src.handlers import voice as handler
from src.schemas.response import ok

voice_router = APIRouter(
    prefix="/voice",
    tags=["Voice"],
)


@voice_router.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    user_id: int = Depends(get_current_user_id),
):
    """Accept an audio upload and return transcribed text + metadata."""
    return ok(await handler.transcribe(file, user_id))


@voice_router.post("/synthesize")
async def synthesize_speech(
    body: handler.SynthesizeRequest,
    user_id: int = Depends(get_current_user_id),
):
    """Convert text to WAV via Kokoro-82M. Auth required (same JWT as other REST)."""
    del user_id  # auth gate only; synthesis is not user-scoped
    wav_bytes, content_type = await handler.synthesize(body.text)
    return Response(
        content=wav_bytes,
        media_type=content_type,
        headers={"Cache-Control": "no-store"},
    )
