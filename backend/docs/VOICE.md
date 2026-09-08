# Voice mode

End-to-end voice chat: **mic → STT → agent (WS) → TTS → speaker**. Typed chat is unchanged.

## Architecture

```
FE Voice UI (VoiceRecorderButton / NawabChat / useNawabWS)
  → Next BFF  /api/v1/voice/transcribe|synthesize  (+ /api/ws-token)
  → FastAPI   /api/v1/voice/*  → handlers/voice.py → stt/ | tts/
  → WebSocket /api/v1/chat/ws  → streaming.run_agent_stream(voice_mode=…)
```

| Layer | Role |
| --- | --- |
| FE | Record audio, call BFF STT, send WS `run` with `voice_mode: true`, speak final reply via BFF TTS |
| BFF | Cookie → `Authorization` proxy; mint short-lived WS ticket (JWT never returned to JS) |
| API | Thin routes; JWT required on voice REST |
| Handler / provider | `handlers/voice.py` → `stt/groq_whisper` / `tts` factory (Kokoro) |
| WS / agent | `voice_mode` injects ephemeral `VOICE_MODE_PROMPT` (Devanagari + brevity); stripped before Redis/DB persist |

## Auth

- Voice REST: same JWT as other APIs (HttpOnly cookie or Bearer).
- Browser WS: `GET /api/ws-token` → backend `POST /auth/ws-ticket` (single-use, TTL). Cookie JWT still works for non-browser clients.
- Metrics and list/feedback clamps are hardened alongside this work (auth on `/metrics`, pagination/message limits).

## Voice-mode behavior

- Client sets `"voice_mode": true` on the WS `run` frame after STT.
- Prompt is passed via pydantic-ai `instructions` for that turn only — not stored in history.
- TTS failures are non-fatal (UI keeps the text reply). Missing TTS deps → synthesize **503**.

## Config / limits

See `.env.sample`: `GROQ_*`, `TTS_*` (`TTS_VOICE=hm_psi`, `TTS_SPEED=1.05`), `HF_TOKEN`, `MAX_STT_FILE_BYTES` (default 8 MiB), WS run/connect rate limits.

- STT: Groq Whisper; MIME/extension allowlist; capped upload read; Urdu→Hindi one-shot retry.
- TTS: optional `requirements-tts.txt` + `espeak-ng`; lazy load; Python **3.12** (not 3.14+). Silence trim keeps ~40 ms pad.

## Run locally

```bash
# backend/ — Python 3.12 venv with optional TTS
pip install -r requirements.txt -r requirements-tts.txt   # + brew/apt install espeak-ng
# Prefer 127.0.0.1:9000 (see frontend .env.example). Set GROQ_API_KEY for STT.
python main.py
```

Without TTS packages, chat/STT still work; synthesize returns 503.

## Test

```bash
cd backend && pytest -q
# voice: test_voice_transcribe / test_voice_synthesize / test_voice_mode_history
# security: test_security_fixes
# frontend (from frontend/): npx vitest run app/lib/__tests__/tts.test.ts app/hooks/__tests__/useNawabWS.voice.test.tsx
```
