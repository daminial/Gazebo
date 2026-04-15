"""add_grid_visible_to_room_settings

Revision ID: 687968e4a997
Revises: 3dffbc1d6ceb
Create Date: 2026-04-05 23:22:18.164315
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '687968e4a997'
down_revision: Union[str, Sequence[str], None] = '3dffbc1d6ceb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('room_settings', sa.Column('grid_visible', sa.Boolean(), nullable=True, server_default='true'))


def downgrade() -> None:
    op.drop_column('room_settings', 'grid_visible')
