from dotenv import load_dotenv
import os

load_dotenv()

class Settings:
    # AI providers
    GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
    GEMINI_MODEL_NAME = os.getenv('GEMINI_MODEL_NAME', 'google:gemini-3-flash-preview')
    OPENAI_MODEL_NAME = os.getenv('OPENAI_MODEL_NAME', 'openai:gpt-5.2')
    SERPER_API_KEY = os.getenv('SERPER_API_KEY')
    API_TIMEOUT = int(os.getenv('API_TIMEOUT', 10))

    # Auth
    JWT_SECRET = os.getenv('JWT_SECRET')
    JWT_ALGORITHM = os.getenv('JWT_ALGORITHM')
    GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID')

    # App
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
    ENVIRONMENT = os.getenv('ENVIRONMENT', 'production')

    # Rate limiting / workers
    RATE_LIMIT = int(os.getenv('RATE_LIMIT', 100))
    MAX_WORKERS = int(os.getenv('MAX_WORKERS', 10))
    BAN_THRESHOLD = int(os.getenv('BAN_THRESHOLD', 5))
    BAN_DURATION = int(os.getenv('BAN_DURATION', 3600))

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


settings = Settings()