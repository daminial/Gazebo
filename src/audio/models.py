# src/audio/models.py — новый файл

from sqlalchemy import (
    Column, Integer, String, ForeignKey, 
    Boolean, DateTime, func, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from src.core.database import Base
from src.audio.enum import RepeatMode
from sqlalchemy import Enum as SAEnum


class Playlist(Base):
    """Плейлист (может быть личный или комнатный)"""
    __tablename__ = "playlists"

    id = Column(Integer, primary_key=True, autoincrement=True)
    
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    
    owner_id = Column(UUID(as_uuid=True),
                      ForeignKey("users.id", ondelete="CASCADE"),
                      nullable=True)
    
    room_id = Column(UUID(as_uuid=True),
                     ForeignKey("rooms.id", ondelete="CASCADE"),
                     nullable=True)
    
    is_public = Column(Boolean, default=False)
    
    cover_image_id = Column(Integer,
                            ForeignKey("images.id", ondelete="SET NULL"),
                            nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    cover_image = relationship("Image", foreign_keys=[cover_image_id])
    tracks = relationship("PlaylistTrack",
                          back_populates="playlist",
                          cascade="all, delete-orphan",
                          order_by="PlaylistTrack.position")
    room_players = relationship("RoomAudioPlayer",
                                back_populates="playlist",
                                foreign_keys="RoomAudioPlayer.current_playlist_id")


class PlaylistTrack(Base):
    """Трек в плейлисте"""
    __tablename__ = "playlist_tracks"

    id = Column(Integer, primary_key=True, autoincrement=True)

    playlist_id = Column(Integer,
                         ForeignKey("playlists.id", ondelete="CASCADE"),
                         nullable=False)
    audio_id = Column(Integer,
                      ForeignKey("audio_files.id", ondelete="CASCADE"),
                      nullable=False)

    position = Column(Integer, nullable=False, default=0)
    
    custom_title = Column(String, nullable=True)
    custom_artist = Column(String, nullable=True)

    added_at = Column(DateTime(timezone=True), server_default=func.now())

    playlist = relationship("Playlist", back_populates="tracks")
    audio = relationship("Audio")

    __table_args__ = (
        UniqueConstraint('playlist_id', 'position', name='uq_playlist_position'),
        UniqueConstraint('playlist_id', 'audio_id', name='uq_playlist_audio'),
    )


class RoomAudioTrack(Base):
    """Аудиотрек, добавленный в комнату (аналог RoomMap для карт)"""
    __tablename__ = "room_audio_tracks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    
    room_id = Column(UUID(as_uuid=True),
                     ForeignKey("rooms.id", ondelete="CASCADE"),
                     nullable=False)
    
    audio_file_id = Column(Integer,
                           ForeignKey("audio_files.id", ondelete="CASCADE"),
                           nullable=False)
    
    name_in_room = Column(String, nullable=True)
    
    added_by = Column(UUID(as_uuid=True),
                      ForeignKey("users.id", ondelete="SET NULL"),
                      nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    room = relationship("Room", back_populates="audio_tracks")
    audio_file = relationship("Audio")
    added_by_user = relationship("User", foreign_keys=[added_by])


class RoomAudioPlayer(Base):
    """Состояние аудиоплеера в комнате"""
    __tablename__ = "room_audio_players"

    id = Column(Integer, primary_key=True, autoincrement=True)
    
    room_id = Column(UUID(as_uuid=True),
                     ForeignKey("rooms.id", ondelete="CASCADE"),
                     nullable=False,
                     unique=True)

    current_playlist_id = Column(Integer,
                                 ForeignKey("playlists.id", ondelete="SET NULL"),
                                 nullable=True)
    current_track_id = Column(Integer,
                              ForeignKey("audio_files.id", ondelete="SET NULL"),
                              nullable=True)
    
    track_position_ms = Column(Integer, default=0)
    playlist_index = Column(Integer, default=0)
    
    is_playing = Column(Boolean, default=False)
    volume = Column(Integer, default=70)
    repeat_mode = Column(SAEnum(RepeatMode), default=RepeatMode.NONE)
    shuffle = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    room = relationship("Room", back_populates="audio_player")
    playlist = relationship("Playlist",
                            foreign_keys=[current_playlist_id],
                            back_populates="room_players")
    current_track = relationship("Audio",
                                 foreign_keys=[current_track_id])