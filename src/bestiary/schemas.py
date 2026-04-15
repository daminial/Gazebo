from pydantic import BaseModel, Field, ConfigDict, model_validator
from uuid import UUID
from datetime import datetime
from typing import Optional, Dict, Any, List
from src.bestiary.enum import CreatureSize, CreatureType


class CreatureTemplateBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=5000)
    max_hp: Optional[int] = Field(None, ge=1)
    ac: Optional[int] = Field(None, ge=0)
    caption: Optional[str] = Field(None, max_length=500)
    cr: int = Field(..., ge=0, le=30)
    size: CreatureSize
    type: CreatureType
    data: Dict[str, Any] = Field(default_factory=dict)


class CreatureTemplateCreate(CreatureTemplateBase):
    is_public: bool = False


class CreatureTemplateUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=5000)
    image_id: Optional[int] = Field(None, gt=0)
    max_hp: Optional[int] = Field(None, ge=1)
    ac: Optional[int] = Field(None, ge=0)
    cr: Optional[int] = Field(None, ge=0, le=30)
    size: Optional[CreatureSize] = None
    type: Optional[CreatureType] = None
    data: Optional[Dict[str, Any]] = None
    is_public: Optional[bool] = None


class CreatureTemplateResponse(CreatureTemplateBase):
    id: int
    owner_id: UUID
    is_public: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode='before')
    @classmethod
    def set_owner_and_public(cls, data):
        if hasattr(data, 'image') and data.image:
            data.owner_id = data.image.uploaded_by
            data.is_public = data.image.is_public
            data.created_at = data.image.created_at
            data.updated_at = data.image.updated_at
        return data


class CreatureTemplateListItem(BaseModel):
    id: int
    name: str
    size: CreatureSize
    type: CreatureType
    cr: int
    image_id: int
    is_public: bool

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode='before')
    @classmethod
    def set_owner_and_public(cls, data):
        if hasattr(data, 'image') and data.image:
            data.owner_id = data.image.uploaded_by
            data.is_public = data.image.is_public
        return data

#Схемы существ в комнате
class RoomTokenBase(BaseModel):
    name_in_room: str = Field(..., min_length=1, max_length=255)
    position_x: float = 0
    position_y: float = 0
    width: Optional[int] = Field(None, gt=0)
    height: Optional[int] = Field(None, gt=0)
    rotation: float = Field(0, ge=0, lt=360)
    is_visible: bool = True
    current_hp: Optional[int] = Field(None, ge=0)
    current_ac: Optional[int] = Field(None, ge=0)
    conditions: List[str] = Field(default_factory=list)


class RoomTokenCreate(RoomTokenBase):
    creature_template_id: Optional[int] = Field(None, gt=0)
    controlled_by: Optional[UUID] = None


class RoomTokenPropCreate(BaseModel):
    """Схема для создания prop-токена (изображение на поле)"""
    image_id: int
    name_in_room: str = Field(..., min_length=1, max_length=255)
    position_x: float = 0
    position_y: float = 0
    width: Optional[int] = Field(None, gt=0)
    height: Optional[int] = Field(None, gt=0)


class RoomTokenUpdate(BaseModel):
    name_in_room: Optional[str] = Field(None, min_length=1, max_length=255)
    position_x: Optional[float] = None
    position_y: Optional[float] = None
    width: Optional[int] = Field(None, gt=0)
    height: Optional[int] = Field(None, gt=0)
    rotation: Optional[float] = Field(None, ge=0, lt=360)
    is_visible: Optional[bool] = None
    current_hp: Optional[int] = Field(None, ge=0)
    current_ac: Optional[int] = Field(None, ge=0)
    conditions: List[str] = Field(default_factory=list)
    controlled_by: Optional[UUID] = None


class RoomTokenResponse(RoomTokenBase):
    id: int
    room_id: UUID
    creature_template_id: Optional[int]
    controlled_by: Optional[UUID]
    created_at: datetime
    updated_at: datetime
    template: Optional['CreatureTemplateListItem'] = None

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode='before')
    @classmethod
    def set_timestamps(cls, data):
        return data


class RoomTokenPositionUpdate(BaseModel):
    position_x: float
    position_y: float
    rotation: Optional[float] = Field(None, ge=0, lt=360)


class RoomTokenBatchUpdate(BaseModel):
    token_ids: List[int]
    position_x: Optional[float] = None
    position_y: Optional[float] = None
    is_visible: Optional[bool] = None
    controlled_by: Optional[UUID] = None
