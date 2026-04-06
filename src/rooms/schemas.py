from pydantic import BaseModel, Field, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Optional, List
from src.rooms.enum import RoomStatus, RoomRole


# схемы для настроек комнаты
class RoomSettingsBase(BaseModel):
    is_public: bool = False
    grid_size: int = Field(50, ge=10, le=200)
    grid_visible: bool = True
    players_can_draw: bool = False
    music_volume: int = Field(70, ge=0, le=100)
    require_password: bool = False


class RoomSettingsCreate(RoomSettingsBase):
    pass


class RoomSettingsUpdate(BaseModel):
    is_public: Optional[bool] = None
    grid_size: Optional[int] = Field(None, ge=10, le=200)
    grid_visible: Optional[bool] = None
    players_can_draw: Optional[bool] = None
    music_volume: Optional[int] = Field(None, ge=0, le=100)
    require_password: Optional[bool] = None


class RoomSettingsResponse(RoomSettingsBase):
    id: int
    room_id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# схемы для страниц комнаты
class RoomPageBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    background_color: str = "#FFFFFF"
    canvas_width: int = Field(1920, gt=0)
    canvas_height: int = Field(1080, gt=0)
    grid_size: int = Field(50, ge=10, le=200)
    grid_visible: bool = True
    players_can_draw: bool = False
    order: int = 0


class RoomPageCreate(RoomPageBase):
    map_id: Optional[int] = Field(None, gt=0)
    background_image_id: Optional[int] = Field(None, gt=0)


class RoomPageUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    background_color: Optional[str] = None
    canvas_width: Optional[int] = Field(None, gt=0)
    canvas_height: Optional[int] = Field(None, gt=0)
    grid_size: Optional[int] = Field(None, ge=10, le=200)
    grid_visible: Optional[bool] = None
    players_can_draw: Optional[bool] = None
    order: Optional[int] = None
    map_id: Optional[int] = Field(None, gt=0)
    background_image_id: Optional[int] = Field(None, gt=0)


class RoomPageResponse(RoomPageBase):
    id: int
    room_id: UUID
    map_id: Optional[int]
    background_image_id: Optional[int]
    created_at: datetime
    updated_at: Optional[datetime] = None

    map_name: Optional[str] = None
    map_image_url: Optional[str] = None
    background_image_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class RoomPageListItem(BaseModel):
    id: int
    room_id: UUID
    name: str
    map_id: Optional[int]
    background_image_id: Optional[int]
    background_color: str
    canvas_width: int
    canvas_height: int
    grid_size: int
    grid_visible: bool
    order: int
    created_at: datetime

    background_image_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# схемы для комнат
class RoomCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)


class RoomUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    status: Optional[RoomStatus] = None


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
    current_page_id: Optional[int] = None

    settings: Optional[RoomSettingsResponse] = None
    pages: Optional[List[RoomPageListItem]] = None

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


class LiveKitTokenResponse(BaseModel):
    token: str
    url: str
    room_id: UUID


class RoomUserListItem(BaseModel):
    user_id: UUID
    username: str
    room_role: RoomRole
    joined_at: datetime

    model_config = ConfigDict(from_attributes=True)


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


# схемы для сообщений чата
class ChatMessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)
    message_type: str = Field(default="text")


class ChatMessageResponse(BaseModel):
    id: int
    room_id: UUID
    user_id: Optional[UUID] = None
    username: Optional[str] = None
    content: str
    message_type: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ChatMessageListResponse(BaseModel):
    messages: List[ChatMessageResponse]
    total: int
