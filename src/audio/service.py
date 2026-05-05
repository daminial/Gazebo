from io import BytesIO
from typing import Optional, List
from uuid import UUID
from fastapi import HTTPException, UploadFile
from sqlalchemy import select, func, update, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.audio.models import Playlist, PlaylistTrack, RoomAudioTrack, RoomAudioPlayer
from src.audio.schemas import (
    PlaylistCreate, PlaylistUpdate, PlaylistTrackCreate,
    RoomAudioTrackCreate, RoomAudioPlayerUpdate
)
from src.audio.enum import RepeatMode, PlayerAction
from src.core.storage.models import Audio
from src.core.storage.s3Client import S3Client
from src.core.storage.schemas import AudioCreate
from src.core.storage.service import MediaService


class AudioService:
    def __init__(self, db: AsyncSession, media_service: MediaService):
        self.db = db
        self.media_service = media_service
    
    async def upload_audio_to_library(
        self,
        file: UploadFile,
        user_id: UUID,
        title: Optional[str] = None,
        artist: Optional[str] = None,
        is_public: bool = False,
    ) -> Audio:
        """Загрузить аудиофайл в общую библиотеку"""
        file_data = await file.read()
        
        audio_create = AudioCreate(
            filename=file.filename.rsplit('.', 1)[0],
            extension=file.filename.split('.')[-1].lower(),
            mime_type=file.content_type or "audio/mpeg",
            file_size=len(file_data),
            type="audio",
            uploaded_by=user_id,
            is_public=is_public,
            title=title or file.filename.rsplit('.', 1)[0],
            artist=artist,
        )
        
        file_bytes = BytesIO(file_data)
        response = await self.media_service.upload_file(
            file=file_bytes,
            file_data=audio_create,
            user_id=user_id
        )
        
        result = await self.db.execute(
            select(Audio).where(Audio.id == response.id)
        )
        return result.scalar_one()

    async def get_library_audio(
        self,
        user_id: Optional[UUID] = None,
        search: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[Audio]:
        """Получить аудио из общей библиотеки"""
        query = select(Audio).where(Audio.deleted_at.is_(None))
        
        if not user_id:
            query = query.where(Audio.is_public == True)
        else:
            query = query.where(
                (Audio.is_public == True) | (Audio.uploaded_by == user_id)
            )
        
        if search:
            query = query.where(
                (Audio.title.ilike(f"%{search}%")) | 
                (Audio.artist.ilike(f"%{search}%"))
            )
        
        query = query.order_by(Audio.created_at.desc()).offset(offset).limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def add_audio_to_room(
        self,
        room_id: UUID,
        data: RoomAudioTrackCreate,
        user_id: UUID,
    ) -> RoomAudioTrack:
        """Добавить аудио в комнату (из библиотеки)"""
        audio = await self.db.get(Audio, data.audio_file_id)
        if not audio:
            raise HTTPException(404, "Аудиофайл не найден")
        
        room_track = RoomAudioTrack(
            room_id=room_id,
            audio_file_id=data.audio_file_id,
            name_in_room=data.name_in_room or audio.title,
            added_by=user_id,
        )
        self.db.add(room_track)
        await self.db.flush()
        
        result = await self.db.execute(
            select(RoomAudioTrack)
            .where(RoomAudioTrack.id == room_track.id)
            .options(selectinload(RoomAudioTrack.audio_file))
        )
        return result.scalar_one()
    
    async def get_audio_url(self, audio) -> str:
        """Получить URL для аудиофайла"""
        if not audio:
            return ""
        
        if audio.storage_provider == "s3":
            public_url = await self.media_service.s3.get_public_url(audio.storage_key)
            if public_url and not public_url.startswith("http://localhost"):
                return public_url
        
        return f"/api/media/audio/{audio.id}"

    async def get_room_audio_tracks(self, room_id: UUID) -> List[RoomAudioTrack]:
        """Получить все аудиотреки в комнате"""
        result = await self.db.execute(
            select(RoomAudioTrack)
            .where(RoomAudioTrack.room_id == room_id)
            .options(selectinload(RoomAudioTrack.audio_file))
            .order_by(RoomAudioTrack.created_at)
        )
        return list(result.scalars().all())

    async def remove_audio_from_room(self, track_id: int):
        """Удалить аудио из комнаты"""
        track = await self.db.get(RoomAudioTrack, track_id)
        if track:
            await self.db.delete(track)

    async def create_playlist(
        self,
        data: PlaylistCreate,
        owner_id: UUID,
        room_id: Optional[UUID] = None,
    ) -> Playlist:
        """Создать плейлист"""
        playlist = Playlist(
            name=data.name,
            description=data.description,
            owner_id=owner_id,
            room_id=room_id,
            is_public=data.is_public,
        )
        self.db.add(playlist)
        await self.db.flush()
        await self.db.refresh(playlist)
        return playlist

    async def get_playlist(self, playlist_id: int) -> Optional[Playlist]:
        """Получить плейлист с треками"""
        result = await self.db.execute(
            select(Playlist)
            .where(Playlist.id == playlist_id)
            .options(
                selectinload(Playlist.tracks)
                .selectinload(PlaylistTrack.audio)
            )
        )
        return result.scalar_one_or_none()

    async def get_user_playlists(self, user_id: UUID) -> List[Playlist]:
        """Получить плейлисты пользователя"""
        result = await self.db.execute(
            select(Playlist)
            .where(
                (Playlist.owner_id == user_id) | 
                ((Playlist.room_id.isnot(None)) & (Playlist.is_public == True))
            )
            .options(selectinload(Playlist.tracks))
            .order_by(Playlist.updated_at.desc())
        )
        return list(result.scalars().all())

    async def update_playlist(
        self,
        playlist_id: int,
        data: PlaylistUpdate,
    ) -> Playlist:
        """Обновить плейлист"""
        playlist = await self.get_playlist(playlist_id)
        if not playlist:
            raise HTTPException(404, "Плейлист не найден")
        
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(playlist, key, value)
        
        await self.db.flush()
        await self.db.refresh(playlist)
        return playlist

    async def delete_playlist(self, playlist_id: int):
        """Удалить плейлист"""
        playlist = await self.db.get(Playlist, playlist_id)
        if playlist:
            await self.db.delete(playlist)

    async def add_track_to_playlist(
        self,
        playlist_id: int,
        data: PlaylistTrackCreate,
    ) -> PlaylistTrack:
        """Добавить трек в плейлист"""
        playlist = await self.get_playlist(playlist_id)
        if not playlist:
            raise HTTPException(404, "Плейлист не найден")
        
        audio = await self.db.get(Audio, data.audio_id)
        if not audio:
            raise HTTPException(404, "Аудиофайл не найден")
        
        max_pos_result = await self.db.execute(
            select(func.max(PlaylistTrack.position))
            .where(PlaylistTrack.playlist_id == playlist_id)
        )
        max_pos = max_pos_result.scalar() or -1
        
        track = PlaylistTrack(
            playlist_id=playlist_id,
            audio_id=data.audio_id,
            position=max_pos + 1,
            custom_title=data.custom_title,
            custom_artist=data.custom_artist,
        )
        self.db.add(track)
        await self.db.flush()
        await self.db.refresh(track)
        return track

    async def remove_track_from_playlist(self, track_id: int):
        """Удалить трек из плейлиста"""
        track = await self.db.get(PlaylistTrack, track_id)
        if track:
            playlist_id = track.playlist_id
            position = track.position
            await self.db.delete(track)
            
            await self.db.execute(
                update(PlaylistTrack)
                .where(
                    (PlaylistTrack.playlist_id == playlist_id) & 
                    (PlaylistTrack.position > position)
                )
                .values(position=PlaylistTrack.position - 1)
            )

    async def reorder_tracks(
        self,
        playlist_id: int,
        track_orders: List[dict],
    ):
        """Переупорядочить треки в плейлисте"""
        for item in track_orders:
            await self.db.execute(
                update(PlaylistTrack)
                .where(PlaylistTrack.id == item["track_id"])
                .values(position=item["new_position"])
            )


    async def get_or_create_player(self, room_id: UUID) -> RoomAudioPlayer:
        """Получить или создать плеер комнаты"""
        result = await self.db.execute(
            select(RoomAudioPlayer)
            .where(RoomAudioPlayer.room_id == room_id)
            .options(
                selectinload(RoomAudioPlayer.current_track),
                selectinload(RoomAudioPlayer.playlist)
                .selectinload(Playlist.tracks)
                .selectinload(PlaylistTrack.audio)
            )
        )
        player = result.scalar_one_or_none()
        
        if not player:
            player = RoomAudioPlayer(room_id=room_id)
            self.db.add(player)
            await self.db.flush()
        
        return player

    async def update_player(
        self,
        room_id: UUID,
        data: RoomAudioPlayerUpdate,
    ) -> RoomAudioPlayer:
        """Обновить состояние плеера"""
        player = await self.get_or_create_player(room_id)
        
        if data.playlist_id is not None:
            player.current_playlist_id = data.playlist_id
            player.playlist_index = 0
        
        if data.track_id is not None:
            player.current_track_id = data.track_id
        
        if data.volume is not None:
            player.volume = data.volume
        
        if data.repeat_mode is not None:
            player.repeat_mode = data.repeat_mode
        
        if data.shuffle is not None:
            player.shuffle = data.shuffle
        
        if data.seek_position_ms is not None:
            player.track_position_ms = data.seek_position_ms
        
        if data.action:
            player = await self._handle_player_action(player, data.action)
        
        await self.db.flush()
        
        result = await self.db.execute(
            select(RoomAudioPlayer)
            .where(RoomAudioPlayer.id == player.id)
            .options(
                selectinload(RoomAudioPlayer.current_track),
                selectinload(RoomAudioPlayer.playlist)
                .selectinload(Playlist.tracks)
                .selectinload(PlaylistTrack.audio)
            )
        )
        return result.scalar_one()
    
    async def serialize_room_track(self, track: RoomAudioTrack) -> dict:
        """Сериализовать трек комнаты с URL"""
        result = {
            "id": track.id,
            "room_id": track.room_id,
            "audio_file_id": track.audio_file_id,
            "name_in_room": track.name_in_room,
            "added_by": track.added_by,
            "created_at": track.created_at,
        }
        
        if track.audio_file:
            result["audio"] = {
                "id": track.audio_file.id,
                "title": track.audio_file.title,
                "artist": track.audio_file.artist,
                "duration_seconds": track.audio_file.duration_seconds,
                "url": await self.get_audio_url(track.audio_file),
            }
        
        return result
    
    async def serialize_player(self, player: RoomAudioPlayer) -> dict:
        """Сериализовать плеер в словарь для ответа"""
        current_track_dict = None
        if player.current_track:
            url = None
            if player.current_track.storage_key:
                url = f"/api/media/{player.current_track.id}"
            
            current_track_dict = {
                "id": player.current_track.id,
                "title": getattr(player.current_track, 'title', None),
                "artist": getattr(player.current_track, 'artist', None),
                "album": getattr(player.current_track, 'album', None),
                "duration_seconds": getattr(player.current_track, 'duration_seconds', None),
                "url": url,
            }
        
        return {
            "id": player.id,
            "room_id": player.room_id,
            "current_playlist_id": player.current_playlist_id,
            "current_track_id": player.current_track_id,
            "current_track": current_track_dict,
            "track_position_ms": player.track_position_ms,
            "playlist_index": player.playlist_index,
            "is_playing": player.is_playing,
            "volume": player.volume,
            "repeat_mode": player.repeat_mode.value if player.repeat_mode else "none",
            "shuffle": player.shuffle,
        }

    async def _handle_player_action(
        self,
        player: RoomAudioPlayer,
        action: str,
    ) -> RoomAudioPlayer:
        """Обработка действий плеера"""
        
        if action == PlayerAction.PLAY.value:
            player.is_playing = True
            if not player.current_track_id and player.current_playlist_id:
                playlist = await self.get_playlist(player.current_playlist_id)
                if playlist and playlist.tracks:
                    first_track = playlist.tracks[0]
                    player.current_track_id = first_track.audio_id
                    player.track_position_ms = 0
        
        elif action == PlayerAction.PAUSE.value:
            player.is_playing = False
        
        elif action == PlayerAction.STOP.value:
            player.is_playing = False
            player.track_position_ms = 0
        
        elif action == PlayerAction.NEXT.value:
            if player.current_playlist_id:
                playlist = await self.get_playlist(player.current_playlist_id)
                if playlist and playlist.tracks:
                    current_idx = player.playlist_index
                    next_idx = (current_idx + 1) % len(playlist.tracks)
                    
                    if next_idx == 0 and player.repeat_mode != RepeatMode.ALL:
                        player.is_playing = False
                        player.track_position_ms = 0
                    else:
                        player.playlist_index = next_idx
                        player.current_track_id = playlist.tracks[next_idx].audio_id
                        player.track_position_ms = 0
        
        elif action == PlayerAction.PREV.value:
            if player.current_playlist_id:
                playlist = await self.get_playlist(player.current_playlist_id)
                if playlist and playlist.tracks:
                    current_idx = player.playlist_index
                    prev_idx = (current_idx - 1) % len(playlist.tracks)
                    player.playlist_index = prev_idx
                    player.current_track_id = playlist.tracks[prev_idx].audio_id
                    player.track_position_ms = 0
        
        elif action == "seek":
            pass
        
        return player
    