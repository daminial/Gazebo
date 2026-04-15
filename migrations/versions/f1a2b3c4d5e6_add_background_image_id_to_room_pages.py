"""add background_image_id to room_pages

Revision ID: f1a2b3c4d5e6
Revises: 687968e4a997
Create Date: 2026-04-06
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision = 'f1a2b3c4d5e6'
down_revision = '687968e4a997'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'room_pages',
        sa.Column('background_image_id', sa.Integer(), nullable=True)
    )
    op.create_foreign_key(
        'fk_room_pages_background_image_id',
        'room_pages', 'images',
        ['background_image_id'], ['id'],
        ondelete='SET NULL'
    )


def downgrade() -> None:
    op.drop_constraint(
        'fk_room_pages_background_image_id',
        'room_pages',
        type_='foreignkey'
    )
    op.drop_column('room_pages', 'background_image_id')
