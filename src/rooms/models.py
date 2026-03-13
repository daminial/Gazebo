from sqlalchemy import Column, UUID, String, Integer, ForeignKey, DateTime, func, Enum
import uuid

from enum import Enum as PyEnum
from sqlalchemy.orm import relationship

from src.core.database import Base


class RoomStatus(str, PyEnum):
    "Статусы игровой комнаты"
    IN_GAME = "in_game"
    PAUSED = "paused"

class RoomRole(str, PyEnum):
    "Роли внутри комнаты"
    DM = "dm"
    PLAYER = "player"
    SPECTATOR = "spectator"


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


class Room(Base):
    __tablename__ = "rooms"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    status = Column(Enum(RoomStatus), default=RoomStatus.PAUSED)

    owner_id = Column(UUID(as_uuid=True),
                      ForeignKey("users.id", ondelete="CASCADE"),
                      nullable=False,
                      index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    owner = relationship("User", foreign_keys=[owner_id])

    settings = relationship("RoomSettings", back_populates="room",
                            uselist=False, cascade="all, delete-orphan")
    users = relationship("RoomUsers", back_populates="room",
                         cascade="all, delete-orphan")

    maps = relationship("RoomMap", back_populates="room",
                        cascade="all, delete-orphan",
                        foreign_keys="RoomMap.room_id")

    tokens = relationship("RoomToken", back_populates="room",
                          cascade="all, delete-orphan")

    audio_player = relationship("RoomAudioPlayer", back_populates="room",
                                uselist=False, cascade="all, delete-orphan")