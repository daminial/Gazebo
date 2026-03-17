from pydantic import BaseModel, Field, ConfigDict, model_validator
from uuid import UUID
from datetime import datetime
from typing import Optional


class MapTemplateBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)

class MapTemplateCreate(MapTemplateBase):
    is_public: bool = False
    caption: Optional[str] = None


class MapTemplateUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    image_id: Optional[int] = Field(None, gt=0)
    is_public: Optional[bool] = None


class MapTemplateResponse(MapTemplateBase):
    id: int
    owner_id: UUID
    is_public: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode='before')
    @classmethod
    def set_extra_fields(cls, data):
        if hasattr(data, 'image') and data.image:
            data.is_public = data.image.is_public
            data.created_at = data.image.created_at
            data.updated_at = data.image.updated_at
            data.owner_id = data.image.uploaded_by
        return data


class MapTemplateListItem(BaseModel):
    id: int
    name: str
    description: Optional[str]
    image_id: int
    is_public: bool
    owner_id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode='before')
    @classmethod
    def set_extra_fields(cls, data):
        if hasattr(data, 'image') and data.image:
            data.is_public = data.image.is_public
            data.created_at = data.image.created_at
            data.updated_at = data.image.updated_at
            data.owner_id = data.image.uploaded_by
        return data


#Схемы для карт внутри комнаты
class RoomMapBase(BaseModel):
    name_in_room: str = Field(..., min_length=1, max_length=255)


class RoomMapCreate(RoomMapBase):
    room_id: UUID
    template_id: int = Field(..., gt=0)


class RoomMapUpdate(BaseModel):
    name_in_room: Optional[str] = Field(None, min_length=1, max_length=255)
    template_id: Optional[int] = Field(None, gt=0)


class RoomMapResponse(RoomMapBase):
    id: int
    room_id: UUID
    template_id: Optional[int]
    created_at: datetime
    updated_at: datetime

    template: Optional['MapTemplateResponse'] = None

    model_config = ConfigDict(from_attributes=True)


class RoomMapListItem(BaseModel):
    id: int
    room_id: UUID
    name_in_room: str
    template_id: Optional[int]
    created_at: datetime

    template_name: Optional[str] = None
    template_image_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)
