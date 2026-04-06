from sqlalchemy import Column, UUID, String, Integer, ForeignKey, DateTime, func, Enum, Boolean
import uuid
from typing import TYPE_CHECKING

from src.rooms.enum import RoomStatus, RoomRole
from sqlalchemy.orm import relationship

from src.core.database import Base

if TYPE_CHECKING:
    from src.bestiary.models import RoomToken


class RoomUsers(Base):
    __tablename__ = "room_users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    room_id = Column(UUID(as_uuid=True),
                     ForeignKey("rooms.id", ondelete="CASCADE"),
                     nullable=False)
    user_id = Column(UUID(as_uuid=True),
                     ForeignKey("users.id", ondelete="SET NULL"),
                     nullable=False)

    room_role = Column(Enum(RoomRole), nullable=False)
    joined_at = Column(DateTime(timezone=True), server_default=func.now())

    room = relationship("Room", back_populates="users")
    user = relationship("User", back_populates="room_associations")


class RoomSettings(Base):
    __tablename__ = "room_settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    room_id = Column(UUID(as_uuid=True),
                     ForeignKey("rooms.id", ondelete="CASCADE"),
                     nullable=False,
                     unique=True)

    is_public = Column(Boolean, default=False)

    grid_size = Column(Integer, default=50)
    grid_visible = Column(Boolean, default=True)
    players_can_draw = Column(Boolean, default=False)

    music_volume = Column(Integer, default=70)

    require_password = Column(Boolean, default=False)
    password_hash = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    room = relationship("Room", back_populates="settings")


class RoomPage(Base):
    __tablename__ = "room_pages"

    id = Column(Integer, primary_key=True, autoincrement=True)

    room_id = Column(UUID(as_uuid=True),
                     ForeignKey("rooms.id", ondelete="CASCADE"),
                     nullable=False)

    map_id = Column(Integer,
                    ForeignKey("room_maps.id", ondelete="SET NULL"),
                    nullable=True)

    name = Column(String, nullable=False, default="Страница 1")

    background_color = Column(String, default="#FFFFFF")

    canvas_width = Column(Integer, default=1920)
    canvas_height = Column(Integer, default=1080)

    grid_size = Column(Integer, default=50)
    grid_visible = Column(Boolean, default=True)
    players_can_draw = Column(Boolean, default=False)

    order = Column(Integer, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    room = relationship("Room",
                        back_populates="pages",
                        foreign_keys=[room_id])
    map = relationship("RoomMap", back_populates="pages")
    tokens = relationship("RoomToken", back_populates="page",
                          cascade="all, delete-orphan",
                          primaryjoin="RoomPage.id == RoomToken.page_id")


class Room(Base):
    __tablename__ = "rooms"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    status = Column(Enum(RoomStatus), default=RoomStatus.PAUSED)

    image_id = Column(Integer,
                      ForeignKey("images.id", ondelete="CASCADE"),
                      nullable=False, default=1)
    owner_id = Column(UUID(as_uuid=True),
                      ForeignKey("users.id", ondelete="CASCADE"),
                      nullable=False,
                      index=True)

    current_page_id = Column(Integer,
                    ForeignKey("room_pages.id", ondelete="SET NULL"),
                    nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    image = relationship("Image")

    owner = relationship("User", foreign_keys=[owner_id])

    settings = relationship("RoomSettings", back_populates="room",
                            uselist=False, cascade="all, delete-orphan")

    pages = relationship("RoomPage",
                         back_populates="room",
                         cascade="all, delete-orphan",
                         order_by="RoomPage.order",
                         foreign_keys="RoomPage.room_id")

    current_page = relationship("RoomPage",
                               foreign_keys=[current_page_id],
                               primaryjoin="Room.current_page_id == RoomPage.id",
                               uselist=False)

    users = relationship("RoomUsers", back_populates="room",
                         cascade="all, delete-orphan")

    maps = relationship("RoomMap", back_populates="room",
                        cascade="all, delete-orphan",
                        foreign_keys="RoomMap.room_id")

    tokens = relationship("RoomToken", back_populates="room",
                          cascade="all, delete-orphan",
                          foreign_keys="RoomToken.room_id")

    # audio_players = relationship("RoomAudioPlayer", back_populates="room",
    #                              cascade="all, delete-orphan",
    #                              foreign_keys="RoomAudioPlayer.room_id")
