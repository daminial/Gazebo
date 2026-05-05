from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from src.audio.enum import RepeatMode


class PlaylistCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    is_public: bool = False


class PlaylistUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    is_public: Optional[bool] = None
    cover_image_id: Optional[int] = None


class PlaylistTrackCreate(BaseModel):
    audio_id: int
    custom_title: Optional[str] = None
    custom_artist: Optional[str] = None


class PlaylistTrackReorder(BaseModel):
    track_id: int
    new_position: int


class PlaylistTrackResponse(BaseModel):
    id: int
    audio_id: int
    position: int
    custom_title: Optional[str] = None
    custom_artist: Optional[str] = None
    audio: Optional[dict] = None

    model_config = ConfigDict(from_attributes=True)


class PlaylistResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    owner_id: Optional[UUID] = None
    room_id: Optional[UUID] = None
    is_public: bool
    cover_image_id: Optional[int] = None
    cover_image_url: Optional[str] = None
    tracks_count: int = 0
    created_at: datetime
    tracks: List[PlaylistTrackResponse] = []

    model_config = ConfigDict(from_attributes=True)


class RoomAudioTrackCreate(BaseModel):
    audio_file_id: int
    name_in_room: Optional[str] = None


class RoomAudioTrackResponse(BaseModel):
    id: int
    room_id: UUID
    audio_file_id: int
    name_in_room: Optional[str] = None
    audio: Optional[dict] = None
    audio_url: Optional[str] = None
    added_by: Optional[UUID] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RoomAudioPlayerUpdate(BaseModel):
    playlist_id: Optional[int] = None
    track_id: Optional[int] = None
    action: Optional[str] = Field(None, pattern="^(play|pause|stop|next|prev|seek)$")
    volume: Optional[int] = Field(None, ge=0, le=100)
    repeat_mode: Optional[RepeatMode] = None
    shuffle: Optional[bool] = None
    seek_position_ms: Optional[int] = Field(None, ge=0)


class RoomAudioPlayerResponse(BaseModel):
    id: int
    room_id: UUID
    current_playlist_id: Optional[int] = None
    current_track_id: Optional[int] = None
    current_track: Optional[dict] = None
    track_position_ms: int = 0
    playlist_index: int = 0
    is_playing: bool = False
    volume: int = 70
    repeat_mode: RepeatMode = RepeatMode.NONE
    shuffle: bool = False

    model_config = ConfigDict(from_attributes=True)
