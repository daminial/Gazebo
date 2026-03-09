from pydantic import BaseModel, Field, HttpUrl, ConfigDict, field_validator
from datetime import datetime
from enum import Enum
from typing import Optional, List

from pydantic_core.core_schema import ValidationInfo


class StorageItemType(str, Enum):
    """Типы файлов в хранилище"""
    MAP = "map"
    MUSIC = "music"
    CHARACTER_IMAGE = "character_image"
    AVATAR = "avatar"

    @property
    def max_size(self) -> int:
        """Максимальный размер файла в байтах"""
        size_limits = {
            StorageItemType.MAP: 20 * 1024 * 1024,
            StorageItemType.MUSIC: 100 * 1024 * 1024,
            StorageItemType.CHARACTER_IMAGE: 5 * 1024 * 1024,
            StorageItemType.AVATAR: 2 * 1024 * 1024,
        }
        return size_limits.get(self, 50 * 1024 * 1024)

    @property
    def max_size_mb(self) -> float:
        """Максимальный размер файла в мегабайтах (для отображения)"""
        return self.max_size / (1024 * 1024)


class StorageItemBase(BaseModel):
    """Базовая схема для элемента хранилища"""
    filename: str = Field(max_length=255)
    file_size: int = Field(gt=0)
    mime_type: str = Field(max_length=100)
    item_type: StorageItemType
    room_id: Optional[int] = None
    uploaded_by_id: int
    description: Optional[str] = Field(None, max_length=500)

    model_config = ConfigDict(from_attributes=True)

    @field_validator('mime_type')
    @classmethod
    def validate_mime_type(cls, mime_type: str) -> str:
        if '/' not in mime_type or len(mime_type.split('/')) != 2:
            raise ValueError('Некорректный MIME type')
        return mime_type

    @field_validator('file_size')
    @classmethod
    def validate_file_size(cls, file_size: int, info: ValidationInfo) -> int:
        item_type = info.data.get('item_type')

        if item_type and file_size > item_type.max_size:
            raise ValueError(
                f'Размер файла превышает максимально допустимый '
                f'({item_type.max_size_mb:.1f} МБ)'
            )

        return file_size


class StorageItemCreate(StorageItemBase):
    """Схема для создания элемента хранилища"""
    storage_path: str = Field(max_length=512)
    bucket_name: str = Field(max_length=100)


class StorageItemUpdate(BaseModel):
    """Схема для обновления элемента хранилища"""
    filename: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = Field(None, max_length=500)
    item_type: Optional[StorageItemType] = None


class StorageItemResponse(StorageItemBase):
    """Схема ответа с данными элемента хранилища"""
    id: int
    storage_path: str
    bucket_name: str
    uploaded_at: datetime
    download_url: Optional[HttpUrl] = None

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": 1,
                "filename": "dungeon_map.jpg",
                "file_size": 2048576,
                "mime_type": "image/jpeg",
                "item_type": "map",
                "room_id": 123,
                "uploaded_by_id": 456,
                "description": "Карта подземелья первого уровня",
                "storage_path": "rooms/123/dungeon_map.jpg",
                "bucket_name": "gazebo-maps",
                "uploaded_at": "2024-01-15T10:30:00",
                "download_url": "https://storage.example.com/rooms/123/dungeon_map.jpg?token=xxx"
            }
        }
    )


class StorageItemListResponse(BaseModel):
    """Схема ответа со списком элементов"""
    items: List[StorageItemResponse]
    total: int
    page: int = 1
    size: int = 20


class FileUploadResponse(BaseModel):
    """Ответ после загрузки файла"""
    item: StorageItemResponse
    message: str = "Файл успешно загружен"


class FileUploadError(BaseModel):
    """Схема ошибки при загрузке"""
    filename: str
    error: str
    details: Optional[str] = None


class BatchUploadResponse(BaseModel):
    """Ответ при множественной загрузке"""
    successful: List[StorageItemResponse]
    failed: List[FileUploadError]
    total_success: int
    total_failed: int


class FileDeleteResponse(BaseModel):
    """Ответ после удаления файла"""
    id: int
    filename: str
    message: str = "Файл успешно удален"


class StorageItemFilter(BaseModel):
    """Фильтры для списка элементов"""
    room_id: Optional[int] = None
    uploaded_by_id: Optional[int] = None
    item_type: Optional[StorageItemType] = None
    mime_type: Optional[str] = None
    filename_search: Optional[str] = Field(None, description="Поиск по имени файла")
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    page: int = Field(1, ge=1)
    size: int = Field(20, ge=1, le=100)


class StorageStats(BaseModel):
    """Статистика использования хранилища"""
    total_files: int
    total_size: int
    files_by_type: dict[StorageItemType, int]
    size_by_type: dict[StorageItemType, int]
    recent_uploads: List[StorageItemResponse]


class SignedUrlResponse(BaseModel):
    """Ответ с подписанной ссылкой"""
    url: HttpUrl
    expires_at: datetime
    item_id: int
    filename: str


class SignedUrlRequest(BaseModel):
    """Запрос на получение подписанной ссылки"""
    item_id: int
    expires_in_seconds: int = Field(3600, ge=60, le=86400)


class FilePermissionCheck(BaseModel):
    """Проверка прав доступа к файлу"""
    user_id: int
    item_id: int
    permission: str
    has_permission: bool


class MapMetadata(BaseModel):
    """Метаданные для карт"""
    width: int = Field(gt=0)
    height: int = Field(gt=0)
    grid_size: Optional[int] = 50
    background_color: Optional[str] = "#FFFFFF"
    is_combat_map: bool = False


class MusicMetadata(BaseModel):
    """Метаданные для музыки"""
    duration: float = Field(gt=0)
    artist: Optional[str] = None
    album: Optional[str] = None
    title: Optional[str] = None
    bitrate: Optional[int] = None
    is_playlist: bool = False


class StorageItemDetailResponse(StorageItemResponse):
    """Расширенная информация о файле"""
    metadata: Optional[dict] = None
    thumbnail_url: Optional[HttpUrl] = None
    is_favorite: bool = False
    share_count: int = 0
    last_accessed: Optional[datetime] = None
    tags: List[str] = []

    model_config = ConfigDict(from_attributes=True)

