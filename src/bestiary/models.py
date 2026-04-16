"""Создаем модели для существ"""

from enum import Enum as PyEnum
from sqlalchemy import (
    Column, Integer, String, ForeignKey,
    Boolean, Float, DateTime, func, JSON,
    Index, Enum, ARRAY)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from src.core.database import Base

from src.bestiary.enum import CreatureType, CreatureSize


class TokenType(PyEnum):
    """Тип токена в комнате"""
    CREATURE = "creature"
    PROP = "prop"


class CreatureTemplate(Base):
    """Шаблон существа в бестиарии"""
    __tablename__ = "creature_templates"

    id = Column(Integer, primary_key=True, autoincrement=True)

    name = Column(String, nullable=False)
    description = Column(String, nullable=True)

    image_id = Column(Integer,
                      ForeignKey("images.id", ondelete="SET NULL"),
                      nullable=True)

    max_hp = Column(Integer, nullable=True)
    ac = Column(Integer, nullable=True)

    cr = Column(Integer, nullable=False)
    size = Column(Enum(CreatureSize), nullable=False)
    type = Column(Enum(CreatureType), nullable=False)

    data = Column(JSON, nullable=True, default={})

    image = relationship("Image")
    room_instances = relationship("RoomToken", back_populates="creature_template")

    __table_args__ = (
        Index('idx_creature_cr', 'cr'),
        Index('idx_creature_size', 'size'),
        Index('idx_creature_type', 'type'),
    )


class RoomToken(Base):
    """Токен существа в комнате"""
    __tablename__ = "room_tokens"

    id = Column(Integer, primary_key=True, autoincrement=True)

    room_id = Column(UUID(as_uuid=True),
                     ForeignKey("rooms.id", ondelete="CASCADE"),
                     nullable=False)
    page_id = Column(Integer,
                     ForeignKey("room_pages.id", ondelete="CASCADE"),
                     nullable=True)
    creature_template_id = Column(Integer,
                                  ForeignKey("creature_templates.id", ondelete="SET NULL"),
                                  nullable=True)
    name_in_room = Column(String, nullable=False)

    position_x = Column(Float, nullable=False, default=0)
    position_y = Column(Float, nullable=False, default=0)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    rotation = Column(Float, default=0)

    is_visible = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now())

    controlled_by = Column(UUID(as_uuid=True),
                           ForeignKey("users.id", ondelete="SET NULL"),
                           nullable=True)

    current_hp = Column(Integer, nullable=True)
    current_ac = Column(Integer, nullable=True)
    conditions = Column(ARRAY(String), nullable=False, default=list, server_default='{}')

    room = relationship("Room", back_populates="tokens")
    page = relationship("RoomPage", back_populates="tokens")
    creature_template = relationship("CreatureTemplate", back_populates="room_instances")
    controller = relationship("User", foreign_keys=[controlled_by])

    __table_args__ = (
        Index('idx_room_tokens_room', 'room_id'),
        Index('idx_room_tokens_position', 'room_id', 'position_x', 'position_y'),
    )
