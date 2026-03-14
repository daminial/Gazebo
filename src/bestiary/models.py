from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, Float, DateTime, func, JSON, Index
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from src.core.database import Base


class CreatureTemplate(Base):
    """Шаблон существа в бестиарии"""
    __tablename__ = "creature_templates"

    id = Column(Integer, primary_key=True, autoincrement=True)

    name = Column(String, nullable=False)
    description = Column(String, nullable=True)

    image_id = Column(Integer,
                      ForeignKey("images.id", ondelete="SET NULL"),
                      nullable=False)

    max_hp = Column(Integer, nullable=True)
    default_ac = Column(Integer, nullable=True)
    size = Column(String, nullable=True)
    type = Column(String, nullable=True)

    data = Column(JSON, nullable=True, default={})

    image = relationship("Image")
    room_instances = relationship("RoomToken", back_populates="creature_template")


class RoomToken(Base):
    """Токен существа в комнате"""
    __tablename__ = "room_tokens"

    id = Column(Integer, primary_key=True, autoincrement=True)

    room_id = Column(UUID(as_uuid=True),
                     ForeignKey("rooms.id", ondelete="CASCADE"),
                     nullable=False)
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

    controlled_by = Column(UUID(as_uuid=True),
                           ForeignKey("users.id", ondelete="SET NULL"),
                           nullable=True)

    current_hp = Column(Integer, nullable=True)
    current_ac = Column(Integer, nullable=True)
    conditions = Column(JSON, nullable=True, default=[])

    room = relationship("Room", back_populates="tokens")
    creature_template = relationship("CreatureTemplate", back_populates="room_instances")
    image = relationship("Image")
    controller = relationship("User", foreign_keys=[controlled_by])

    __table_args__ = (
        Index('ix_room_tokens_room_map', 'room_id'),
        Index('ix_room_tokens_position', 'room_id', 'position_x', 'position_y'),
    )
