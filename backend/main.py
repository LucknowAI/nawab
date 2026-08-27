import time
from contextlib import asynccontextmanager

try:
    import uvloop
    uvloop.install()
except ImportError:
    pass

import logfire
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from src.schemas.response import fail

from src.api.chat import chat_router
from src.api.ws import ws_chat_router
from src.api.city import city_router
from src.api.health import health_router
from src.api.auth import router as auth_router
from src.api.feedback import feedback_router
from src.middleware.rate_limiter import RateLimiter
from src.config.settings import settings
from src.utils.util_logger.logger import logger


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Nawab AI 2.0")

    # Connect to Redis (graceful — won't abort startup if Redis is unavailable)
    try:
        from src.database.redis import redis_manager
        await redis_manager.connect()
    except Exception as exc:
        logger.warning("Redis unavailable at startup — rate limiting falls back to in-memory", extra={"error": str(exc)})

    yield

    logger.info("Shutting down Nawab AI 2.0")
    try:
        from src.database.redis import redis_manager
        await redis_manager.disconnect()
    except Exception:
        pass


# Debug tracing — LOGFIRE_TOKEN set → ships to logfire.pydantic.dev; unset →
# prints spans to console (agent runs, tool calls, LLM requests) with zero setup.
logfire.configure(send_to_logfire="if-token-present", console=logfire.ConsoleOptions(verbose=True))
logfire.instrument_pydantic_ai()

rate_limiter = RateLimiter()

app = FastAPI(
    title="Nawab Chat API",
    description="AI assistant for Indian cities — Lucknow, Delhi, and more",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.ENVIRONMENT == "development" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT == "development" else None,
    openapi_url="/openapi.json" if settings.ENVIRONMENT == "development" else None,
)

# CORS — allow_origins=["*"] + allow_credentials=True is rejected by browsers.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["POST", "GET", "OPTIONS", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "Authorization", "Accept"],
    expose_headers=["Cache-Control", "X-Accel-Buffering", "Content-Type"],
)

logfire.instrument_fastapi(app)


@app.middleware("http")
async def throttle_and_time_request(request: Request, call_next):
    """Rate-limit the caller, hold a worker slot for the request, and time it."""
    start_time = time.time()

    # Middleware runs outside the exception handlers below, so this one wraps
    # its own rejection.
    try:
        await rate_limiter.check_rate_limit(request)
    except HTTPException as e:
        return fail(e.detail, e.status_code)

    await rate_limiter.acquire_worker()

    try:
        response = await call_next(request)
        process_time = time.time() - start_time
        response.headers["X-Process-Time"] = str(process_time)
        logger.info(
            "Request completed",
            extra={"path": request.url.path, "duration_ms": round(process_time * 1000, 1)},
        )
        return response
    except Exception as e:
        logger.error("Unhandled request error", extra={"error": str(e)})
        raise
    finally:
        rate_limiter.release_worker()


# ---------------------------------------------------------------------------
# Error envelope — every failed REST response is a StandardError, so routes and
# handlers only ever raise. Registered on the Starlette base class so 404s the
# router itself raises are wrapped too.
# ---------------------------------------------------------------------------

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return fail(exc.detail, exc.status_code)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return fail(exc.errors(), 422)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    # Log the traceback but never return it — the text can carry connection
    # strings, query fragments, or tokens.
    logger.exception("Unhandled error", extra={"path": request.url.path})
    return fail("Internal server error", 500)


# Routers
app.include_router(chat_router, prefix="/api/v1")
app.include_router(ws_chat_router, prefix="/api/v1")
app.include_router(city_router, prefix="/api/v1")
app.include_router(health_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(feedback_router, prefix="/api/v1")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=9000, reload=True,
                loop="uvloop", http="httptools")
