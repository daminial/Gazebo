from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, DateTime, func, Index, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from src.core.database import Base


class Playlist(Base):
    """Плейлист в аудиотеке пользователя"""
    __tablename__ = "playlists"

    id = Column(Integer, primary_key=True, autoincrement=True)

    name = Column(String, nullable=False)
    description = Column(String, nullable=True)

    cover_image_id = Column(Integer,
                            ForeignKey("images.id", ondelete="SET NULL"),
                            nullable=True)

    cover_image = relationship("Image")
    tracks = relationship("PlaylistTrack", back_populates="playlist",
                          cascade="all, delete-orphan")
    room_players = relationship("RoomAudioPlayer", back_populates="playlist")


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

    position = Column(Integer, nullable=False)

    custom_title = Column(String, nullable=True)
    custom_artist = Column(String, nullable=True)

    added_at = Column(DateTime(timezone=True), server_default=func.now())

    playlist = relationship("Playlist", back_populates="tracks")
    audio = relationship("Audio")

    __table_args__ = (
        UniqueConstraint('playlist_id', 'position', name='unique_playlist_position'),
        UniqueConstraint('playlist_id', 'audio_id', name='unique_playlist_audio'),
    )


class RoomAudioPlayer(Base):
    """Аудиоплеер комнаты"""
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
    track_position = Column(Integer, default=0)
    is_playing = Column(Boolean, default=False)

    volume = Column(Integer, default=70)
    repeat_mode = Column(String, default="none")
    shuffle = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    room = relationship("Room", back_populates="audio_player")
    playlist = relationship("Playlist", foreign_keys=[current_playlist_id],
                            back_populates="room_players")
    current_track = relationship("Audio", foreign_keys=[current_track_id])
