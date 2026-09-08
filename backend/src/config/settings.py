from dotenv import load_dotenv
import os

load_dotenv()

# Algorithms permitted for JWT verify/sign. Anything else is rejected at startup.
_ALLOWED_JWT_ALGORITHMS = frozenset({"HS256"})


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or raw == "":
        return default
    return int(raw)


class Settings:
    # AI providers
    GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
    GEMINI_MODEL_NAME = os.getenv('GEMINI_MODEL_NAME', 'google:gemini-3-flash-preview')
    OPENAI_MODEL_NAME = os.getenv('OPENAI_MODEL_NAME', 'openai:gpt-5.2')
    SERPER_API_KEY = os.getenv('SERPER_API_KEY')
    API_TIMEOUT = int(os.getenv('API_TIMEOUT', 10))

    # STT — Groq Whisper (used by POST /api/v1/voice/transcribe)
    GROQ_API_KEY = os.getenv('GROQ_API_KEY')
    GROQ_TRANSCRIPTION_URL = os.getenv(
        'GROQ_TRANSCRIPTION_URL',
        'https://api.groq.com/openai/v1/audio/transcriptions',
    )
    # Reject uploads larger than this before buffering the whole body in memory.
    # Frontend recordings are short webm/mp4 clips; 8 MiB is a safe ceiling.
    MAX_STT_FILE_BYTES: int = _env_int('MAX_STT_FILE_BYTES', 8 * 1024 * 1024)

    # TTS — Kokoro-82M Hindi (lazy-loaded on first /voice/synthesize; no warmup)
    TTS_PROVIDER: str = os.getenv('TTS_PROVIDER', 'kokoro')
    TTS_MODEL_ID: str = os.getenv('TTS_MODEL_ID', 'hexgrad/Kokoro-82M')
    TTS_DEVICE: str = os.getenv('TTS_DEVICE', 'auto')  # auto | cpu | cuda | mps
    TTS_MAX_CHARS: int = int(os.getenv('TTS_MAX_CHARS', '500'))
    TTS_VOICE: str = os.getenv('TTS_VOICE', 'hm_psi')  # Hindi: hf_alpha/beta, hm_omega/psi
    TTS_LANG_CODE: str = os.getenv('TTS_LANG_CODE', 'h')  # Kokoro: h = Hindi
    TTS_SPEED: float = float(os.getenv('TTS_SPEED', '1.05'))
    HF_TOKEN: str = os.getenv("HF_TOKEN") or os.getenv("HUGGINGFACE_HUB_TOKEN") or ""

    # Auth
    JWT_SECRET = os.getenv('JWT_SECRET')
    JWT_ALGORITHM = os.getenv('JWT_ALGORITHM', 'HS256')
    GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID')
    # Short-lived opaque ticket for browser → backend WebSocket auth (not a JWT).
    WS_TICKET_TTL_SECONDS: int = _env_int('WS_TICKET_TTL_SECONDS', 60)
    # OTP verify brute-force guard (request-side limit is separate).
    OTP_VERIFY_MAX_ATTEMPTS: int = _env_int('OTP_VERIFY_MAX_ATTEMPTS', 5)
    OTP_VERIFY_WINDOW_SECONDS: int = _env_int('OTP_VERIFY_WINDOW_SECONDS', 600)

    # App
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
    ENVIRONMENT = os.getenv('ENVIRONMENT', 'production')

    # Rate limiting / workers
    RATE_LIMIT = int(os.getenv('RATE_LIMIT', 100))
    MAX_WORKERS = int(os.getenv('MAX_WORKERS', 10))
    BAN_THRESHOLD = int(os.getenv('BAN_THRESHOLD', 5))
    BAN_DURATION = int(os.getenv('BAN_DURATION', 3600))
    # WebSocket run limits (per authenticated user). Prefer Redis when connected;
    # otherwise process-local counters (documented on the limiter).
    WS_RUN_RATE_LIMIT: int = _env_int('WS_RUN_RATE_LIMIT', 30)
    WS_RUN_RATE_WINDOW_SECONDS: int = _env_int('WS_RUN_RATE_WINDOW_SECONDS', 60)
    WS_MAX_CONCURRENT_RUNS: int = _env_int('WS_MAX_CONCURRENT_RUNS', 1)
    WS_CONNECT_RATE_LIMIT: int = _env_int('WS_CONNECT_RATE_LIMIT', 30)
    WS_CONNECT_RATE_WINDOW_SECONDS: int = _env_int('WS_CONNECT_RATE_WINDOW_SECONDS', 60)

    # List/pagination clamps
    MAX_LIST_LIMIT: int = _env_int('MAX_LIST_LIMIT', 100)
    MAX_FEEDBACK_MESSAGE_CHARS: int = _env_int('MAX_FEEDBACK_MESSAGE_CHARS', 1000)

    # Cache
    CACHE_PREFIX = os.getenv('CACHE_PREFIX', 'nawab:')

    # Database
    POSTGRES_DB_URL = os.getenv('POSTGRES_DB_URL')
    REDIS_URL: str = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
    SESSION_TIMEOUT: int = int(os.getenv('SESSION_TIMEOUT', 3600))
    MAX_CONTEXT_MESSAGES: int = int(os.getenv('MAX_CONTEXT_MESSAGES', 20))

    # Token/context guard — see src/utils/context_budget.py.
    # MAX_USER_MESSAGE_CHARS: hard cap on a single incoming chat message.
    # MAX_HISTORY_CHARS: cap on the serialized message_history sent to the
    # model per request; MAX_CONTEXT_MESSAGES bounds it by turn count first,
    # this is a second pass in case individual turns are large (long tool
    # results, pasted text). ~4 chars/token, so defaults are a comfortable
    # margin under typical 32k+ token context windows.
    MAX_USER_MESSAGE_CHARS: int = int(os.getenv('MAX_USER_MESSAGE_CHARS', 8000))
    MAX_HISTORY_CHARS: int = int(os.getenv('MAX_HISTORY_CHARS', 60000))

    # Email / SMTP (used for OTP delivery)
    SMTP_HOST     : str = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT     : int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER     : str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD : str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM     : str = os.getenv("SMTP_FROM", "Nawab AI <noreply@example.com>")

    # City / multi-persona
    DEFAULT_CITY_ID: str = os.getenv('DEFAULT_CITY_ID', 'lucknow')

    # CORS — comma-separated list of allowed frontend origins
    FRONTEND_ORIGINS: list[str] = [
        o.strip()
        for o in os.getenv('FRONTEND_ORIGINS', 'http://localhost:3000').split(',')
        if o.strip()
    ]

    # Cookie security — True in production (HTTPS), False in local dev
    @property
    def COOKIE_SECURE(self) -> bool:
        override = os.getenv('COOKIE_SECURE')
        if override is not None:
            return override.lower() == 'true'
        return self.ENVIRONMENT != 'development'

    # SameSite=none required when frontend and backend are on different domains.
    # Must be paired with secure=True or browsers will reject the cookie.
    COOKIE_SAMESITE: str = os.getenv('COOKIE_SAMESITE', 'none')

    def validate_jwt_config(self) -> None:
        """Reject missing/weak JWT secrets and disallowed algorithms.

        Production always requires a strong secret. Development may use a short
        local secret for convenience, but still only allowlisted algorithms.
        Never log the secret value.
        """
        algo = (self.JWT_ALGORITHM or "").strip()
        if algo not in _ALLOWED_JWT_ALGORITHMS:
            raise RuntimeError(
                f"JWT_ALGORITHM must be one of {sorted(_ALLOWED_JWT_ALGORITHMS)}; "
                f"got {algo!r}"
            )
        secret = self.JWT_SECRET or ""
        is_prod = self.ENVIRONMENT != "development"
        if not secret:
            raise RuntimeError("JWT_SECRET is required")
        if is_prod and len(secret) < 32:
            raise RuntimeError("JWT_SECRET must be at least 32 characters in production")
        if is_prod and secret.lower() in {"secret", "changeme", "password", "jwt_secret"}:
            raise RuntimeError("JWT_SECRET is too weak for production")


settings = Settings()
# Validate at import so misconfiguration fails fast (tests set env before import).
settings.validate_jwt_config()
