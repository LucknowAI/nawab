# Nawab AI — backend

Nawabai is a comprehensive system designed to integrate multiple APIs and LLMs to provide seamless responses to user queries. It incorporates various API adaptors — Google Maps, News API, YouTube, Lucknow Metro fares, and more — and uses a Gemini-based agent to interact with language models. Currently scoped to Lucknow.

FastAPI + PostgreSQL + Redis backend, with Google Sign-In / OTP auth and streaming chat (SSE + WebSocket). Paired with the [frontend](../frontend) Next.js app in this repo.

## Prerequisites

- Python 3.12+
- PostgreSQL (running, with a database created)
- Redis (running — used for rate limiting; falls back to in-memory if unavailable)

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Copy the env template and fill in values:

```bash
cp .env.sample .env
```

Required for a working local setup:

| Variable | Purpose |
|---|---|
| `POSTGRES_DB_URL` | e.g. `postgresql+asyncpg://user:password@localhost:5432/nawab` |
| `REDIS_URL` | e.g. `redis://localhost:6379/0` |
| `JWT_SECRET` / `JWT_ALGORITHM` | session token signing (e.g. `HS256`) |
| `GOOGLE_CLIENT_ID` | OAuth client ID from Google Cloud Console, for Google Sign-In |
| `GEMINI_API_KEY` and/or `OPENAI_API_KEY` | at least one LLM provider key for chat to work |
| `FRONTEND_ORIGINS` | comma-separated list of allowed CORS origins, e.g. `http://localhost:3000,http://localhost:9001` |

SMTP vars (`SMTP_HOST`/`SMTP_USER`/`SMTP_PASSWORD`) are only needed if you're testing OTP email delivery.

## Database

Run migrations before first start (and after pulling any schema change):

```bash
alembic upgrade head
```

## Run

```bash
python main.py
```

Starts on `http://localhost:9000` with auto-reload. Interactive API docs at `/docs` when `ENVIRONMENT=development`.

Alternatively, mirroring the production entrypoint:

```bash
gunicorn main:app -k uvicorn.workers.UvicornWorker -w 2 -b 0.0.0.0:9000
```

## Tests

```bash
pytest
```

Tests hitting real external APIs are excluded by default (marked `network`); run them explicitly with:

```bash
pytest -m network
```

## Docker

```bash
docker build -t nawab-backend .
docker run --env-file .env -p 8080:8080 nawab-backend
```

The container runs `alembic upgrade head` automatically before starting Gunicorn.

## More docs

- [Architecture](docs/ARCHITECTURE.md) — request flow, agent/tools, persistence, deploy.
- [Contributing](CONTRIBUTING.md) — code style, tests. See the [repo-wide CONTRIBUTING.md](../CONTRIBUTING.md) for branching, PRs, and CI.
