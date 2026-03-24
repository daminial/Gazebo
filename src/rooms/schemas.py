from pydantic import BaseModel, Field, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Optional, List
from src.rooms.enum import RoomStatus, RoomRole

# схемы для комнат
class RoomCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    image_id: Optional[int] = Field(None, description="ID изображения для комнаты")


class RoomUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    status: Optional[RoomStatus] = None
    image_id: Optional[int] = Field(None, description="ID изображения для комнаты")


class RoomListItem(BaseModel):
    id: UUID
    name: str
    status: RoomStatus
    owner_id: UUID
    created_at: datetime
    image_id: Optional[int] = None

    users_count: int = 0
    maps_count: int = 0
    tokens_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class RoomResponse(BaseModel):
    id: UUID
    name: str = Field(..., min_length=1, max_length=255)
    owner_id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    status: RoomStatus = RoomStatus.PAUSED
    image_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


# схемы для пользователей в комнате

class RoomUserBase(BaseModel):
    room_role: RoomRole


class RoomUserCreate(RoomUserBase):
    user_id: UUID


class RoomUserUpdate(BaseModel):
    room_role: Optional[RoomRole] = None


class RoomUserResponse(RoomUserBase):
    id: int
    room_id: UUID
    user_id: UUID
    joined_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RoomUserListItem(BaseModel):
    user_id: UUID
    username: str
    room_role: RoomRole
    joined_at: datetime

    model_config = ConfigDict(from_attributes=True)


# схемы для карт
class RoomMapBasicInfo(BaseModel):
    id: int
    name_in_room: str
    template_id: Optional[int]

    image_id: Optional[int] = None
    template_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class RoomMapCreate(BaseModel):
    template_id: int
    name_in_room: str


class RoomMapInRoom(RoomMapBasicInfo):
    created_at: datetime
    updated_at: Optional[datetime] = None


# схемы для токенов
class RoomTokenBasicInfo(BaseModel):
    id: int
    name_in_room: str
    position_x: float
    position_y: float
    is_visible: bool

    image_id: Optional[int] = None
    template_name: Optional[str] = None
    template_cr: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class RoomTokenInRoom(RoomTokenBasicInfo):
    creature_template_id: Optional[int]
    controlled_by: Optional[UUID]
    current_hp: Optional[int]
    current_ac: Optional[int]
    conditions: List[str] = []


    model_config = ConfigDict(from_attributes=True)

class TokenPositionUpdate(BaseModel):
    position_x: float
    position_y: float
    rotation: Optional[float] = None

class TokenHPUpdate(BaseModel):
    hp_delta: int

class TokenConditionsUpdate(BaseModel):
    add: Optional[List[str]] = None
    remove: Optional[List[str]] = None
    set: Optional[List[str]] = None
    clear: bool = False

class TokenVisibilityUpdate(BaseModel):
    is_visible: bool
