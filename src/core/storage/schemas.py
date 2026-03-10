from pydantic import BaseModel, Field, HttpUrl, ConfigDict, field_validator, ValidationInfo
from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any, Union
from uuid import UUID

from sqlalchemy import Integer


class MediaType(str, Enum):
    """Типы медиафайлов"""
    MEDIA_FILE = "media_file"
    IMAGE = "image"
    AUDIO = "audio"


class MediaFileBase(BaseModel):
    """Базовая схема для медиафайла (соответствует MediaFile модели)"""
    filename: str = Field(..., max_length=255)
    extension: str = Field(..., max_length=50)
    mime_type: str = Field(..., max_length=100)
    file_size: int = Field(..., gt=0)

    type: MediaType = MediaType.MEDIA_FILE

    uploaded_by: UUID

    is_public: bool = True
    is_processed: bool = False


    model_config = ConfigDict(from_attributes=True)

    @field_validator('mime_type')
    @classmethod
    def validate_mime_type(cls, mime_type: str) -> str:
        if '/' not in mime_type or len(mime_type.split('/')) != 2:
            raise ValueError('Некорректный MIME type. Должен быть в формате "тип/подтип"')
        return mime_type.lower()

    @field_validator('extension')
    @classmethod
    def validate_extension(cls, extension: str) -> str:
        if not extension or '.' in extension:
            raise ValueError('Расширение должно быть без точки (например: "jpg", "mp3")')
        return extension.lower()


class ImageCreate(MediaFileBase):
    """Схема для создания изображения"""
    type: MediaType = MediaType.IMAGE

    width: Optional[int] = Field(None, gt=0)
    height: Optional[int] = Field(None, gt=0)
    blurhash: Optional[str] = Field(None, max_length=100)
    has_alpha: bool = False
    caption: Optional[str] = Field(None, max_length=500)
    palette: Optional[List[str]] = None
    is_dark: Optional[bool] = None
    thumbnail_id: Optional[UUID] = None


class AudioCreate(MediaFileBase):
    """Схема для создания аудио"""
    type: MediaType = MediaType.AUDIO

    duration_seconds: Optional[int] = Field(None, gt=0)
    bitrate: Optional[int] = Field(None, gt=0)
    sample_rate: Optional[int] = Field(None, gt=0)
    audio_codec: Optional[str] = Field(None, max_length=50)

    title: Optional[str] = Field(None, max_length=255)
    artist: Optional[str] = Field(None, max_length=255)
    album: Optional[str] = Field(None, max_length=255)
    genre: Optional[str] = Field(None, max_length=100)

    waveform_data: Optional[List[float]] = Field(None, max_length=1000)
    loudness: Optional[float] = Field(None, ge=-60, le=0)

    @field_validator('duration_seconds')
    @classmethod
    def validate_duration(cls, v: Optional[int]) -> Optional[int]:
        if v and v > 7200:  # Не больше 2 часов
            raise ValueError('Слишком длинный трек')
        return v



class MediaFileCreate(MediaFileBase):
    """Схема для создания медиафайла в БД после загрузки в хранилище"""
    storage_provider: str = Field("local", max_length=50)
    storage_key: str = Field(..., max_length=512, description="Полный путь к файлу в хранилище")
    bucket: Optional[str] = Field(None, max_length=100)


class MediaFileUpdate(BaseModel):
    """Схема для обновления метаданных"""
    filename: Optional[str] = Field(None, max_length=255)
    caption: Optional[str] = Field(None, max_length=500)
    title: Optional[str] = Field(None, max_length=255)
    artist: Optional[str] = Field(None, max_length=255)
    album: Optional[str] = Field(None, max_length=255)
    genre: Optional[str] = Field(None, max_length=100)
    is_public: Optional[bool] = None
    is_processed: Optional[bool] = None

    palette: Optional[List[str]] = None
    is_dark: Optional[bool] = None

    waveform_data: Optional[List[float]] = None
    loudness: Optional[float] = Field(None, ge=-60, le=0)


class MediaFileResponse(MediaFileBase):
    """Схема ответа с данными медиафайла"""
    id: int
    storage_provider: str
    storage_key: str
    bucket: Optional[str]
    uploaded_at: datetime
    deleted_at: Optional[datetime] = None

    palette: Optional[List[str]] = None
    is_dark: Optional[bool] = None
    thumbnail_id: Optional[UUID] = None
    waveform_data: Optional[List[float]] = None
    loudness: Optional[float] = None

    download_url: Optional[HttpUrl] = None
    public_url: Optional[HttpUrl] = None
    thumbnail_url: Optional[HttpUrl] = None

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "filename": "dungeon_map",
                "extension": "jpg",
                "mime_type": "image/jpeg",
                "file_size": 2048576,
                "type": "image",
                "uploaded_by_id": "123e4567-e89b-12d3-a456-426614174001",
                "width": 1920,
                "height": 1080,
                "blurhash": "L5H2EC=PM+yV0g-mq.wG9c010J}I",
                "has_alpha": False,
                "caption": "Карта подземелья",
                "is_public": True,
                "is_processed": True,
                "storage_provider": "s3",
                "storage_key": "maps/2026/02/18/dungeon_map.jpg",
                "bucket": "gazebo",
                "uploaded_at": "2024-01-15T10:30:00",
                "download_url": "https://storage.example.com/gazebo-maps/maps/2026/02/18/dungeon_map.jpg"
            }
        }
    )


class ImageResponse(MediaFileResponse):
    """Специализированный ответ для изображений"""
    type: MediaType = MediaType.IMAGE
    thumbnail: Optional['ImageResponse'] = None


class AudioResponse(MediaFileResponse):
    """Специализированный ответ для аудио"""
    type: MediaType = MediaType.AUDIO


class MediaFileListResponse(BaseModel):
    items: List[MediaFileResponse]
    total: int
    page: int = 1
    size: int = 20
    total_pages: int = 1


class FileUploadResponse(BaseModel):
    item: MediaFileResponse
    message: str = "Файл успешно загружен"


class FileUploadError(BaseModel):
    filename: str
    error: str
    details: Optional[str] = None


class BatchUploadResponse(BaseModel):
    successful: List[MediaFileResponse]
    failed: List[FileUploadError]
    total_success: int
    total_failed: int


class FileDeleteResponse(BaseModel):
    id: int
    filename: str
    message: str = "Файл успешно удален"
    permanently_deleted: bool = False


class MediaFileFilter(BaseModel):
    uploaded_by_id: Optional[UUID] = None
    type: Optional[MediaType] = None
    mime_type: Optional[str] = None
    filename_search: Optional[str] = Field(None, description="Поиск по имени файла")
    extension: Optional[str] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    is_public: Optional[bool] = None
    is_processed: Optional[bool] = None
    include_deleted: bool = False
    page: int = Field(1, ge=1)
    size: int = Field(20, ge=1, le=100)


class StorageStats(BaseModel):
    total_files: int
    total_size: int
    total_size_mb: float
    files_by_type: Dict[str, int]
    files_by_extension: Dict[str, int]
    size_by_type: Dict[str, int]
    recent_uploads: List[MediaFileResponse]


class SignedUrlResponse(BaseModel):
    url: HttpUrl
    expires_at: datetime
    item_id: UUID
    filename: str
    method: str = "GET"


class SignedUrlRequest(BaseModel):
    item_id: int
    expires_in_seconds: int = Field(3600, ge=60, le=86400)
    method: str = Field("GET", pattern="^(GET|PUT)$")


class FilePermissionCheck(BaseModel):
    user_id: UUID
    item_id: int
    permission: str = Field(..., pattern="^(read|write|delete)$")
    has_permission: bool
