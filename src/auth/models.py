"""Создаем модель пользователя"""

from sqlalchemy import Column, String, Boolean, DateTime, UUID, Integer, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from src.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=True)
    full_name = Column(String)
    avatar_id = Column(Integer, ForeignKey("images.id", ondelete="SET NULL"), nullable=True)
    
    email_verified = Column(Boolean, default=False)
    verification_code = Column(String, nullable=True)
    verification_code_expires = Column(DateTime(timezone=True), nullable=True)
    
    oauth_provider = Column(String, nullable=True)
    oauth_provider_id = Column(String, nullable=True)
    
    role = Column(String, default="user")
    
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    avatar = relationship("Image", foreign_keys=[avatar_id])
    media_files = relationship(
        "MediaFile",
        foreign_keys="[MediaFile.uploaded_by]",
        back_populates="uploader",
        cascade="save-update, merge",
        lazy="dynamic"
    )
    room_associations = relationship(
        "RoomUsers",
        foreign_keys="[RoomUsers.user_id]",
        back_populates="user",
        cascade="save-update, merge",
        lazy="dynamic"
    )
    controlled_tokens = relationship(
        "RoomToken",
        foreign_keys="[RoomToken.controlled_by]",
        back_populates="controller",
        cascade="save-update, merge",
        lazy="dynamic"
    )
    map_templates = relationship(
        "MapTemplate",
        back_populates="owner",
        cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<User(id={self.id}, email={self.email})>"