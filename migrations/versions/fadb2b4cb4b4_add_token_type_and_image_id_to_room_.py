"""add token_type and image_id to room_tokens

Revision ID: fadb2b4cb4b4
Revises: 34a8897f31a5
Create Date: 2026-04-06 22:44:31.342261

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fadb2b4cb4b4'
down_revision: Union[str, Sequence[str], None] = '34a8897f31a5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Создаем enum type для token_type
    token_type_enum = sa.Enum('creature', 'prop', name='tokentype')
    token_type_enum.create(op.get_bind())
    
    # Добавляем колонку image_id
    op.add_column('room_tokens',
        sa.Column('image_id', sa.Integer(), sa.ForeignKey('images.id', ondelete='SET NULL'), nullable=True)
    )
    
    # Добавляем колонку token_type со значением по умолчанию 'creature'
    op.add_column('room_tokens',
        sa.Column('token_type', sa.Enum('creature', 'prop', name='tokentype'), 
                  nullable=False, server_default='creature')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('room_tokens', 'token_type')
    op.drop_column('room_tokens', 'image_id')
    
    # Удаляем enum type
    token_type_enum = sa.Enum(name='tokentype')
    token_type_enum.drop(op.get_bind(), checkfirst=True)
