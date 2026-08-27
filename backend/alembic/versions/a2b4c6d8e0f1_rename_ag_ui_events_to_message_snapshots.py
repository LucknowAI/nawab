"""Rename ag_ui_events table and related objects to message_snapshots

Revision ID: a2b4c6d8e0f1
Revises: c3d7e9f12345
Create Date: 2026-04-12 00:00:00.000000

Renames the ag_ui_events table (and its index, unique constraint, and
backing sequence) to message_snapshots to reflect that the table stores
native pydantic-ai message snapshots, not AG-UI protocol events.
"""
from typing import Sequence, Union

from alembic import op

revision: str = "a2b4c6d8e0f1"
down_revision: Union[str, Sequence[str], None] = "c3d7e9f12345"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.rename_table("ag_ui_events", "message_snapshots")

    op.execute(
        "ALTER INDEX ix_ag_ui_events_conversation_id "
        "RENAME TO ix_message_snapshots_conversation_id"
    )
    op.execute(
        "ALTER TABLE message_snapshots "
        "RENAME CONSTRAINT uq_ag_ui_events_conv_seq TO uq_message_snapshots_conv_seq"
    )
    # PostgreSQL names the bigserial backing sequence <table>_id_seq; rename it too.
    op.execute(
        "ALTER SEQUENCE ag_ui_events_id_seq RENAME TO message_snapshots_id_seq"
    )


def downgrade() -> None:
    op.execute(
        "ALTER SEQUENCE message_snapshots_id_seq RENAME TO ag_ui_events_id_seq"
    )
    op.execute(
        "ALTER TABLE message_snapshots "
        "RENAME CONSTRAINT uq_message_snapshots_conv_seq TO uq_ag_ui_events_conv_seq"
    )
    op.execute(
        "ALTER INDEX ix_message_snapshots_conversation_id "
        "RENAME TO ix_ag_ui_events_conversation_id"
    )
    op.rename_table("message_snapshots", "ag_ui_events")
