from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, Float, DateTime, func, JSON, Index
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from src.core.database import Base


class MapTemplate(Base):
    """Шаблон карты в библиотеке пользователя"""
    __tablename__ = "map_templates"

    id = Column(Integer, primary_key=True, autoincrement=True)

    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    image_id = Column(Integer,
                      ForeignKey("images.id", ondelete="CASCADE"),
                      nullable=False)

    image = relationship("Image")
    room_instances = relationship("RoomMap", back_populates="template")


class RoomMap(Base):
    """Экземпляр карты в комнате"""
    __tablename__ = "room_maps"

    id = Column(Integer, primary_key=True, autoincrement=True)

    room_id = Column(UUID(as_uuid=True),
                     ForeignKey("rooms.id", ondelete="CASCADE"),
                     nullable=False)
    template_id = Column(Integer,
                         ForeignKey("map_templates.id", ondelete="SET NULL"),
                         nullable=True)

    name_in_room = Column(String, nullable=False)

    room = relationship("Room", back_populates="maps")
    template = relationship("MapTemplate", back_populates="room_instances")
