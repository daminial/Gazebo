"""
Отвечает за создание моделей необходимых,
для работы с медиафайлами
"""
from sqlalchemy import (
    Column, String, BigInteger, Boolean, Integer,
    Enum, JSON, DateTime, ForeignKey, Index, Float
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid

from src.core.database import Base


class MediaFile(Base):
    """
    Основной класс работающий с медиафайлами,
    хранит все метаданные и настройки м-файлов
    """
    __tablename__ = "media_files"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    storage_provider = Column(String, nullable=False, default="local")
    storage_key = Column(String, nullable=False, unique=True)
    bucket = Column(String, nullable=True)

    filename = Column(String, nullable=False)
    extension = Column(String, nullable=False)
    mime_type = Column(String, nullable=False)
    size_bytes = Column(BigInteger, default=0)

    type = Column(String(50))

    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    blurhash = Column(String, nullable=True)
    has_alpha = Column(Boolean, default=False)

    duration_seconds = Column(Integer, nullable=True)
    bitrate = Column(Integer, nullable=True)
    sample_rate = Column(Integer, nullable=True)
    audio_codec = Column(String, nullable=True)

    uploaded_by = Column(UUID(as_uuid=True),
                         ForeignKey("users.id", ondelete="SET NULL"),
                         nullable=True)
    user = relationship("User", back_populates="media_files")

    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    is_processed = Column(Boolean, default=False)
    is_public = Column(Boolean, default=True)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    __mapper_args__ = {
        "polymorphic_on": type,
        "polymorphic_identity": "media_file",
    }

    __table_args__ = (
        Index('ix_media_files_uploaded_by', 'uploaded_by'),
        Index('ix_media_files_media_type', 'media_type'),
        Index('ix_media_files_uploaded_at', 'uploaded_at'),
        Index('ix_media_files_deleted_at', 'deleted_at'),
    )


class Image(MediaFile):
    """Специализированная модель для изображений.
    Наследует все поля MediaFile.
    """
    __tablename__ = "images"

    id = Column(String,
                ForeignKey("media_files.id", ondelete="CASCADE"),
                primary_key=True)

    palette = Column(JSON, nullable=True)
    is_dark = Column(Boolean, nullable=True)
    caption = Column(String, nullable=True)

    thumbnail_id = Column(String,
                          ForeignKey("images.id", ondelete="CASCADE"),
                          nullable=True)

    thumbnail = relationship("Image",
                             foreign_keys=[thumbnail_id],
                             remote_side=[id])

    __mapper_args__ = {
        "polymorphic_identity": "image",
    }


class Audio(MediaFile):
    """Специализированная модель для аудио."""
    __tablename__ = "audio_files"

    id = Column(String, ForeignKey("media_files.id", ondelete="CASCADE"), primary_key=True)

    title = Column(String, nullable=False)
    artist = Column(String, nullable=True)
    album = Column(String, nullable=True)
    genre = Column(String, nullable=True)

    waveform_data = Column(JSON, nullable=True)
    loudness = Column(Float, nullable=True)

    __mapper_args__ = {
        "polymorphic_identity": "audio",
    }
