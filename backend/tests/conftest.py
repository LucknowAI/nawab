"""Test bootstrap — set safe defaults before modules import Settings / DB engine."""

import os

# load_dotenv() in settings does not override existing keys; set these first so
# importing handlers that touch SQLAlchemy works without a local .env.
if not os.environ.get("POSTGRES_DB_URL"):
    os.environ["POSTGRES_DB_URL"] = (
        "postgresql+asyncpg://nawab:nawab@localhost:5432/nawab_test"
    )
# Isolate JWT hardening from production rules while keeping a non-empty secret.
if not os.environ.get("ENVIRONMENT"):
    os.environ["ENVIRONMENT"] = "development"
if not os.environ.get("JWT_SECRET"):
    os.environ["JWT_SECRET"] = "test-secret-for-unit-tests-only"
if not os.environ.get("JWT_ALGORITHM"):
    os.environ["JWT_ALGORITHM"] = "HS256"
