"""initial

Revision ID: ff4272e4c8f3
Revises: 
Create Date: 2026-05-20 12:20:26.788491

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ff4272e4c8f3'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Создаём все таблицы через SQLAlchemy — он сам разберётся с порядком
    from src.core.database import Base
    from sqlalchemy import create_engine
    import os
    
    db_user = os.getenv("POSTGRES_USER", "gazebo")
    db_password = os.getenv("POSTGRES_PASSWORD", "gazebo")
    db_host = os.getenv("POSTGRES_HOST", "localhost")
    db_port = os.getenv("POSTGRES_PORT", "5432")
    db_name = os.getenv("POSTGRES_DB", "gazebo")
    
    database_url = f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
    engine = create_engine(database_url)
    
    Base.metadata.create_all(engine, checkfirst=True)


def downgrade() -> None:
    # Удаляем все таблицы
    from src.core.database import Base
    from sqlalchemy import create_engine
    import os
    
    db_user = os.getenv("POSTGRES_USER", "gazebo")
    db_password = os.getenv("POSTGRES_PASSWORD", "gazebo")
    db_host = os.getenv("POSTGRES_HOST", "localhost")
    db_port = os.getenv("POSTGRES_PORT", "5432")
    db_name = os.getenv("POSTGRES_DB", "gazebo")
    
    database_url = f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
    engine = create_engine(database_url)
    
    Base.metadata.drop_all(engine)
    