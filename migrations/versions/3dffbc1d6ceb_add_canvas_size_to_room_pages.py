"""add canvas_size to room_pages

Revision ID: 3dffbc1d6ceb
Revises: 
Create Date: 2026-04-05
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '3dffbc1d6ceb'
down_revision: Union[str, None] = 'c5b7f13320a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('room_pages', sa.Column('canvas_width', sa.Integer(), nullable=True, server_default='1920'))
    op.add_column('room_pages', sa.Column('canvas_height', sa.Integer(), nullable=True, server_default='1080'))


def downgrade() -> None:
    op.drop_column('room_pages', 'canvas_height')
    op.drop_column('room_pages', 'canvas_width')
