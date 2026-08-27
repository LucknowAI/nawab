"""merge heads

Revision ID: d7073f85b424
Revises: a2b4c6d8e0f1, e2f3a4b5c6d7
Create Date: 2026-04-12 00:58:35.080806

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd7073f85b424'
down_revision: Union[str, Sequence[str], None] = ('a2b4c6d8e0f1', 'e2f3a4b5c6d7')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
