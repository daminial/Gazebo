"""Создаем модель пользователя"""

from sqlalchemy import Column, String, Boolean, DateTime, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from src.core.database import Base


class User(Base):
    """Модель пользователя"""

    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Тут будут описанны связи с другими моделями
    # maps = relationship("Map", back_populates="owner")
    # owned_rooms = relationship("GameRoom", back_populates="owner")

    def __repr__(self):
        return f"<User(id={self.id}, email={self.email})>"
