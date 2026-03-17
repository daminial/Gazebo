"""
Отвечает за создание моделей необходимых,
для работы с медиафайлами
"""
from sqlalchemy import (
    Column, String, Boolean, Integer,
    Enum, JSON, DateTime, ForeignKey, Index, Float
)
from sqlalchemy import Enum as SQLAlchemyEnum

from src.core.enum import GazeboEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from src.core.database import Base


class MediaType(GazeboEnum):
    """Типы медиафайлов"""
    MEDIA_FILE = "media_file"
    IMAGE = "image"
    AUDIO = "audio"


class MediaFile(Base):
    """
    Основной класс работающий с медиафайлами,
    хранит все метаданные и настройки м-файлов
    """
    __tablename__ = "media_files"

    id = Column(Integer, primary_key=True, autoincrement=True)

    storage_provider = Column(String, nullable=False, default="S3")
    storage_key = Column(String, nullable=False, unique=True)
    bucket = Column(String, nullable=False)

    filename = Column(String, nullable=False)
    extension = Column(String, nullable=False)
    mime_type = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)

    media_type = Column(
        SQLAlchemyEnum(MediaType),
        nullable=False
    )

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now())

    uploaded_by = Column(UUID(as_uuid=True),
                         ForeignKey("users.id", ondelete="SET NULL"),
                         nullable=True)

    is_public = Column(Boolean, default=True)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    uploader = relationship("User", back_populates="media_files")
    __mapper_args__ = {
        "polymorphic_on": media_type,
        "polymorphic_identity": "media_file",
    }

    __table_args__ = (
        Index('idx_media_files_uploaded_by', 'uploaded_by'),
        Index('idx_media_files_media_type', 'media_type'),
        Index('idx_media_files_created_at', 'created_at'),
        Index('idx_media_files_deleted_at', 'deleted_at'),
    )


class Image(MediaFile):
    """Специализированная модель для изображений.
    Наследует все поля MediaFile.
    """
    __tablename__ = "images"

    id = Column(Integer,
                ForeignKey("media_files.id", ondelete="CASCADE"),
                primary_key=True)

    palette = Column(JSON, nullable=True)
    is_dark = Column(Boolean, nullable=True)
    caption = Column(String, nullable=True)

    thumbnail_id = Column(Integer,
                          ForeignKey("images.id", ondelete="CASCADE"),
                          nullable=True)

    thumbnail = relationship("Image",
                             foreign_keys=[thumbnail_id],
                             remote_side=[id])

    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    blurhash = Column(String, nullable=True)
    has_alpha = Column(Boolean, default=False)

    map_templates = relationship("MapTemplate", back_populates="image")
    creature_templates = relationship("CreatureTemplate", back_populates="image")

    __mapper_args__ = {
        "polymorphic_identity": "image",
    }


class Audio(MediaFile):
    """Специализированная модель для аудио."""
    __tablename__ = "audio_files"

    id = Column(Integer, ForeignKey("media_files.id", ondelete="CASCADE"), primary_key=True)

    title = Column(String, nullable=False)
    artist = Column(String, nullable=True)
    album = Column(String, nullable=True)
    genre = Column(String, nullable=True)

    duration_seconds = Column(Integer, nullable=True)
    bitrate = Column(Integer, nullable=True)
    sample_rate = Column(Integer, nullable=True)
    audio_codec = Column(String, nullable=True)

    waveform_data = Column(JSON, nullable=True)
    loudness = Column(Float, nullable=True)

    __mapper_args__ = {
        "polymorphic_identity": "audio",
    }
