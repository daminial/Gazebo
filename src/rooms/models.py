from sqlalchemy import Column, UUID, String, Integer, ForeignKey, DateTime, func, Enum
import uuid

from src.rooms.enum import RoomStatus, RoomRole
from sqlalchemy.orm import relationship

from src.core.database import Base


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

    image_id = Column(Integer,
                      ForeignKey("images.id", ondelete="CASCADE"),
                      nullable=False, default=1)
    owner_id = Column(UUID(as_uuid=True),
                      ForeignKey("users.id", ondelete="CASCADE"),
                      nullable=False,
                      index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    image = relationship("Image")

    owner = relationship("User", foreign_keys=[owner_id])

    # settings = relationship("RoomSettings", back_populates="room",
    #                         uselist=False, cascade="all, delete-orphan")
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
