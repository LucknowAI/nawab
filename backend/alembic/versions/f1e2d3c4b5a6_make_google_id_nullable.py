"""Make users.google_id nullable to support email/OTP login

Revision ID: f1e2d3c4b5a6
Revises: d7073f85b424
Create Date: 2026-04-12 00:00:00.000000

email/OTP users do not have a Google account, so google_id must allow NULL.
PostgreSQL's unique constraint allows multiple NULL values, so existing
uniqueness guarantees for Google users are preserved.
"""
from typing import Sequence, Union

from alembic import op

revision: str = "f1e2d3c4b5a6"
down_revision: Union[str, Sequence[str], None] = "d7073f85b424"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("users", "google_id", nullable=True)


def downgrade() -> None:
    # Restore NOT NULL: fill any NULLs with a synthetic value first
    op.execute("UPDATE users SET google_id = 'email:' || email WHERE google_id IS NULL")
    op.alter_column("users", "google_id", nullable=False)
