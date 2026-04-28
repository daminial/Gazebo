from pydantic import BaseModel, Field, ConfigDict, field_validator
from uuid import UUID
from datetime import datetime
from typing import Optional, List
from decimal import Decimal

from src.core.storage.schemas import ImageResponse


#Схемы для шаблонов карт
class MapTemplateBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)


class MapTemplateCreate(MapTemplateBase):
    is_public: bool = False
    caption: Optional[str] = None
    tags: Optional[List[str]] = Field(default_factory=list)

    @field_validator('tags', mode='before')
    @classmethod
    def validate_tags(cls, v):
        if v is None:
            return []
        if isinstance(v, str):
            if v.strip() == '':
                return []
            return [tag.strip() for tag in v.split(',') if tag.strip()]
        if isinstance(v, list):
            return [tag.strip() for tag in v if isinstance(tag, str) and tag.strip()]
        return []


class MapTemplateUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    image_id: Optional[int] = Field(None, gt=0)
    is_public: Optional[bool] = None
    tags: Optional[List[str]] = Field(None, max_length=10)


class MapTemplateResponse(MapTemplateBase):
    id: int
    owner_id: UUID
    image_id: int
    image: Optional[ImageResponse] = None
    image_url: Optional[str] = None
    is_public: bool
    rating: Decimal = Decimal("0.0")
    votes: int = 0
    created_at: datetime
    updated_at: datetime
    tags: Optional[List[str]] = None

    model_config = ConfigDict(from_attributes=True)


class MapTemplateListItem(BaseModel):
    id: int
    name: str
    description: Optional[str]
    image_id: int
    image_url: Optional[str] = None
    owner_id: UUID
    is_public: bool
    rating: Decimal = Decimal("0.0")
    votes: int = 0
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


#Схемы для карт в комнатах
class RoomMapBase(BaseModel):
    name_in_room: str = Field(..., min_length=1, max_length=255)


class RoomMapCreate(RoomMapBase):
    template_id: Optional[int] = Field(None, gt=0)
    image_id: Optional[int] = Field(None, gt=0)


class RoomMapUpdate(BaseModel):
    name_in_room: Optional[str] = Field(None, min_length=1, max_length=255)
    template_id: Optional[int] = Field(None, gt=0)
    image_id: Optional[int] = Field(None, gt=0)


class RoomMapResponse(RoomMapBase):
    id: int
    room_id: UUID
    template_id: Optional[int]
    image_id: Optional[int]
    created_at: datetime
    updated_at: datetime

    template: Optional['MapTemplateResponse'] = None
    image: Optional['ImageResponse'] = None

    image_url: Optional[str] = None
    template_name: Optional[str] = None
    template_image_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class RoomMapListItem(BaseModel):
    id: int
    room_id: UUID
    name_in_room: str
    template_id: Optional[int]
    image_id: Optional[int]
    created_at: datetime

    template_name: Optional[str] = None
    image_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)