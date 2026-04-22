"""add_creature_stats_columns

Revision ID: 05e0ee0a322b
Revises: ae13963f061b
Create Date: 2026-04-17 22:32:27.064540

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '05e0ee0a322b'
down_revision: Union[str, Sequence[str], None] = 'ae13963f061b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
