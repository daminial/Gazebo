from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from src.audio.schemas import (
    PlaylistCreate, PlaylistUpdate, PlaylistTrackCreate,
    PlaylistResponse, PlaylistTrackResponse,
    RoomAudioTrackCreate, RoomAudioTrackResponse,
    RoomAudioPlayerUpdate, RoomAudioPlayerResponse,
)
from src.audio.service import AudioService
from src.core.database import get_db
from src.auth.dependencies import get_current_user
from src.auth.models import User
from src.core.storage.service import MediaService
from src.core.storage.dependencies import get_s3_client
from src.core.storage.s3Client import S3Client
from src.core.storage.models import Audio
from src.core.storage.schemas import AudioResponse

router = APIRouter(prefix="/audio", tags=["audio"], redirect_slashes=False)


async def get_audio_service(
    db: AsyncSession = Depends(get_db),
    s3_client: S3Client = Depends(get_s3_client),
) -> AudioService:
    media_service = MediaService(s3_client, db)
    return AudioService(db, media_service)


@router.post("/upload", response_model=AudioResponse)
async def upload_audio(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    artist: Optional[str] = Form(None),
    is_public: bool = Form(False),
    service: AudioService = Depends(get_audio_service),
    current_user: User = Depends(get_current_user),
):
    """Загрузить аудиофайл в общую библиотеку"""
    if not file.content_type or not file.content_type.startswith("audio/"):
        raise HTTPException(400, "Только аудиофайлы разрешены")
    
    audio = await service.upload_audio_to_library(
        file=file,
        user_id=current_user.id,
        title=title,
        artist=artist,
        is_public=is_public,
    )
    return audio


@router.get("/library", response_model=List[AudioResponse])
async def list_library_audio(
    search: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    s3_client: S3Client = Depends(get_s3_client),
):
    """Получить аудио из общей библиотеки"""
    media_service = MediaService(s3_client, db)
    service = AudioService(db, media_service)
    return await service.get_library_audio(
        user_id=current_user.id,
        search=search,
        limit=limit,
        offset=offset,
    )


@router.post("/playlists", response_model=PlaylistResponse, status_code=201)
async def create_playlist(
    data: PlaylistCreate,
    room_id: Optional[UUID] = Query(None),
    service: AudioService = Depends(get_audio_service),
    current_user: User = Depends(get_current_user),
):
    """Создать плейлист"""
    playlist = await service.create_playlist(
        data=data,
        owner_id=current_user.id,
        room_id=room_id,
    )
    return playlist


@router.get("/playlists", response_model=List[PlaylistResponse])
async def list_playlists(
    service: AudioService = Depends(get_audio_service),
    current_user: User = Depends(get_current_user),
):
    """Получить плейлисты пользователя"""
    return await service.get_user_playlists(current_user.id)


@router.get("/playlists/{playlist_id}", response_model=PlaylistResponse)
async def get_playlist(
    playlist_id: int,
    service: AudioService = Depends(get_audio_service),
):
    """Получить плейлист"""
    playlist = await service.get_playlist(playlist_id)
    if not playlist:
        raise HTTPException(404, "Плейлист не найден")
    return playlist


@router.patch("/playlists/{playlist_id}", response_model=PlaylistResponse)
async def update_playlist(
    playlist_id: int,
    data: PlaylistUpdate,
    service: AudioService = Depends(get_audio_service),
):
    """Обновить плейлист"""
    return await service.update_playlist(playlist_id, data)


@router.delete("/playlists/{playlist_id}")
async def delete_playlist(
    playlist_id: int,
    service: AudioService = Depends(get_audio_service),
):
    """Удалить плейлист"""
    await service.delete_playlist(playlist_id)
    return {"message": "Плейлист удалён"}


@router.get("/rooms/{room_id}/tracks", response_model=List[RoomAudioTrackResponse])
async def get_room_audio_tracks(
    room_id: UUID,
    service: AudioService = Depends(get_audio_service),
):
    """Получить аудиотреки в комнате"""
    tracks = await service.get_room_audio_tracks(room_id)
    
    result = []
    for track in tracks:
        track_data = RoomAudioTrackResponse.model_validate(track)
        if track.audio_file:
            track_data.audio = {
                "id": track.audio_file.id,
                "title": track.audio_file.title,
                "artist": track.audio_file.artist,
                "duration_seconds": track.audio_file.duration_seconds,
                "url": await service.get_audio_url(track.audio_file),
            }
        result.append(track_data)
    
    return result


@router.post("/playlists/{playlist_id}/tracks", response_model=PlaylistTrackResponse, status_code=201)
async def add_track_to_playlist(
    playlist_id: int,
    data: PlaylistTrackCreate,
    service: AudioService = Depends(get_audio_service),
):
    """Добавить трек в плейлист"""
    return await service.add_track_to_playlist(playlist_id, data)


@router.delete("/playlists/{playlist_id}/tracks/{track_id}")
async def remove_track_from_playlist(
    playlist_id: int,
    track_id: int,
    service: AudioService = Depends(get_audio_service),
):
    """Удалить трек из плейлиста"""
    await service.remove_track_from_playlist(track_id)
    return {"message": "Трек удалён из плейлиста"}


@router.post("/playlists/{playlist_id}/reorder")
async def reorder_playlist_tracks(
    playlist_id: int,
    track_orders: List[dict],
    service: AudioService = Depends(get_audio_service),
):
    """Переупорядочить треки в плейлисте"""
    await service.reorder_tracks(playlist_id, track_orders)
    return {"message": "Порядок треков обновлён"}


@router.post("/rooms/{room_id}/tracks", response_model=RoomAudioTrackResponse, status_code=201)
async def add_audio_to_room(
    room_id: UUID,
    data: RoomAudioTrackCreate,
    service: AudioService = Depends(get_audio_service),
    current_user: User = Depends(get_current_user),
):
    """Добавить аудио в комнату"""
    track = await service.add_audio_to_room(room_id, data, current_user.id)
    return await service.serialize_room_track(track)


@router.get("/rooms/{room_id}/tracks", response_model=List[RoomAudioTrackResponse])
async def get_room_audio_tracks(
    room_id: UUID,
    service: AudioService = Depends(get_audio_service),
):
    """Получить аудиотреки в комнате"""
    tracks = await service.get_room_audio_tracks(room_id)
    return [await service.serialize_room_track(t) for t in tracks]


@router.delete("/rooms/{room_id}/tracks/{track_id}")
async def remove_audio_from_room(
    room_id: UUID,
    track_id: int,
    service: AudioService = Depends(get_audio_service),
):
    """Удалить аудио из комнаты"""
    await service.remove_audio_from_room(track_id)
    return {"message": "Аудио удалено из комнаты"}


@router.get("/rooms/{room_id}/player", response_model=RoomAudioPlayerResponse)
async def get_room_player(
    room_id: UUID,
    service: AudioService = Depends(get_audio_service),
):
    """Получить состояние плеера комнаты"""
    player = await service.get_or_create_player(room_id)
    return await service.serialize_player(player)


@router.patch("/rooms/{room_id}/player", response_model=RoomAudioPlayerResponse)
async def update_room_player(
    room_id: UUID,
    data: RoomAudioPlayerUpdate,
    service: AudioService = Depends(get_audio_service),
):
    """Обновить состояние плеера комнаты"""
    player = await service.update_player(room_id, data)
    return await service.serialize_player(player)
