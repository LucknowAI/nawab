# Architecture

High-level map of how a chat request flows through the backend, and where things live. For setup/run instructions see [README.md](../README.md).

## Stack

FastAPI (ASGI) + PostgreSQL (via SQLAlchemy async + Alembic) + Redis, fronting a [pydantic-ai](https://ai.pydantic.dev/) agent that calls Gemini or OpenAI. Served by Gunicorn with Uvicorn workers in production ([Dockerfile](../Dockerfile)).

## Request flow — chat

1. Client calls `POST /api/v1/chat/chat/new` to create a conversation row and get a `thread_id`.
2. Client opens `WS /api/v1/chat/ws` (primary path — [src/api/ws_chat.py](../src/api/ws_chat.py)) or streams over `POST /api/v1/chat/nawab` (SSE fallback — [src/api/chatRouter.py](../src/api/chatRouter.py)), sending `{"thread_id", "content"}`.
3. History for that thread is loaded Redis-first, DB-fallback, and trimmed to a bounded window before use (`src/utils/context_budget.py` — turn-aware trim by message count and serialized-size budget, both driven by `MAX_CONTEXT_MESSAGES` / `MAX_HISTORY_CHARS` in [src/config/settings.py](../src/config/settings.py)). A single incoming message over `MAX_USER_MESSAGE_CHARS` is rejected outright rather than sent to the model.
4. A per-city `pydantic_ai.Agent` is fetched/built (`agent/main_agent.py`, cached per `city_id`) and run via `agent.run_stream_events(...)`, streaming events back to the client (`text_delta`, `tool_call`, `tool_result`, etc.).
5. On completion, the full message list (`all_messages()`) is saved back to the Redis snapshot immediately, and persisted to Postgres (`ChatMessageModel` + `MessageSnapshotModel`) in a background task.

The SSE and WebSocket paths are independent implementations of the same flow — kept in sync by hand, not shared code, since streaming semantics differ enough (SSE is stateless-per-request; WS keeps a `run_queue`/`input_queue` pair per connection to support the agent's `ask_user` clarifying-question tool).

## Agent & tools (`agent/main_agent.py`)

- One `Agent` instance per city (`_agent_cache`), built from that city's `CityConfig` system prompt plus a shared UI-tools prompt.
- Search tools (`google_search`, `google_maps`, `google_news`, `google_videos`, `google_images`) call Serper via `src/tools/serper.py`.
- `show*` tools (`showPlaces`, `showNews`, etc.) are `tool_plain` no-ops on the backend — they exist so pydantic-ai can pair the model's tool calls with returns; the frontend renders the actual UI from the tool-call arguments it receives over the stream.
- Lucknow gets extra metro tools (`find_metro_route`, `get_metro_fare`) backed by `src/cities/metro/` (static network data + live UPMRC fare lookups with an offline stop-count fallback).
- `ask_user` lets the agent pause a run and wait (up to 5 min) for a clarifying answer from the client over the same WebSocket.

## Cities (`src/cities/`)

Multi-city/multi-persona support: `src/cities/registry.py` maps `city_id` → `CityConfig` (system prompt, greeting, coordinates, location string). Adding a city means adding a config here, not touching the agent or routers.

## Persistence

- **Postgres** (`sqlalchemy_models/`, `src/database/db.py`): `ConversationModel`, `ChatMessageModel` (plain-text, for lightweight history display), `MessageSnapshotModel` (full pydantic-ai message JSON, for exact replay), plus `UserModel` and feedback tables. Migrations in `alembic/`.
- **Redis** (`src/database/redis.py`): session cache, chat snapshot cache (fast-path history), OTP storage, rate-limit counters. Every Redis call degrades gracefully — the app falls back to DB reads / in-memory rate limiting if Redis is unreachable rather than failing requests.

## Auth (`src/auth/`, `src/api/auth/`)

Google Sign-In and email OTP, both issuing a JWT stored in an HttpOnly cookie. `get_current_user_id` (dependency) / `_decode_token` (used directly by the WS handler, which reads the cookie itself since FastAPI dependencies don't run before `websocket.accept()`).

## Cross-cutting middleware (`main.py`, `src/middleware/`)

- CORS restricted to `FRONTEND_ORIGINS`.
- `RateLimiter`: Redis-backed sliding window when available (correct across multiple instances), in-memory fallback otherwise; also caps concurrent in-flight requests via a semaphore sized by `MAX_WORKERS`.
- `/api/v1/health/` reports Postgres + Redis status and returns HTTP 503 if Postgres is down — this is what `deploy-dev.sh` polls after a rollout to decide whether the deploy succeeded, so it must reflect real dependency health rather than always report "healthy".

## Deploy

- `dev` branch: every push auto-deploys via [.github/workflows/deploy-dev.yml](../.github/workflows/deploy-dev.yml) → SSH into the dev VPS → `deploy-dev.sh` (git reset to `origin/dev`, `docker compose build && up`, health-check poll).
- PRs into `main`/`dev`: gated by [.github/workflows/ci.yml](../.github/workflows/ci.yml) (lint, `pytest`, Docker build).
- Production deploy pipeline is not yet automated — tracked in issue #5.
