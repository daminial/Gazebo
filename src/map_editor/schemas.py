from pydantic import BaseModel, Field, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Optional, List


class AssetPackCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    is_public: bool = True


class AssetPackResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    owner_id: UUID
    is_public: bool
    created_at: datetime
    assets_count: Optional[int] = None
    
    model_config = ConfigDict(from_attributes=True)


class AssetCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    image_id: int
    default_width: int = Field(..., gt=0)
    default_height: int = Field(..., gt=0)
    category: Optional[str] = None
    is_rotatable: bool = True
    snap_to_grid: bool = True


class AssetResponse(BaseModel):
    id: int
    pack_id: int
    name: str
    image_id: int
    image_url: Optional[str] = None
    default_width: int
    default_height: int
    category: Optional[str]
    is_rotatable: bool
    snap_to_grid: bool
    
    model_config = ConfigDict(from_attributes=True)


class SceneObjectCreate(BaseModel):
    asset_id: int
    x: float
    y: float
    width: Optional[float] = None
    height: Optional[float] = None
    rotation: float = 0
    z_index: int = 0
    tint_color: Optional[str] = Field(None, pattern=r'^#[0-9a-fA-F]{6}$')
    opacity: float = Field(1.0, ge=0, le=1)
    flipped_h: bool = False
    flipped_v: bool = False
    locked: bool = False


class SceneObjectUpdate(BaseModel):
    x: Optional[float] = None
    y: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    rotation: Optional[float] = None
    z_index: Optional[int] = None
    tint_color: Optional[str] = Field(None, pattern=r'^#[0-9a-fA-F]{6}$')
    opacity: Optional[float] = Field(None, ge=0, le=1)
    flipped_h: Optional[bool] = None
    flipped_v: Optional[bool] = None
    locked: Optional[bool] = None


class SceneObjectResponse(BaseModel):
    id: int
    asset_id: int
    asset_name: Optional[str] = None
    image_url: Optional[str] = None
    x: float
    y: float
    width: Optional[float]
    height: Optional[float]
    rotation: float
    z_index: int
    tint_color: Optional[str]
    opacity: float
    flipped_h: bool
    flipped_v: bool
    locked: bool
    
    model_config = ConfigDict(from_attributes=True)


class BackgroundUpdate(BaseModel):
    grid_data: Optional[List[List[Optional[str]]]] = None
    image_id: Optional[int] = None


class BackgroundResponse(BaseModel):
    grid_data: Optional[List[List[Optional[str]]]] = None
    image_id: Optional[int] = None
    image_url: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


class MapProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    pack_id: int
    orientation: str = Field("horizontal", pattern=r'^(horizontal|vertical)$')
    width: int = Field(..., gt=0)
    height: int = Field(..., gt=0)
    is_public: bool = False


class MapProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    is_public: Optional[bool] = None


class MapProjectResponse(BaseModel):
    id: int
    name: str
    owner_id: UUID
    orientation: str
    width: int
    height: int
    pack_id: Optional[int]
    template_id: Optional[int]
    is_public: bool
    created_at: datetime
    updated_at: datetime
    background: Optional[BackgroundResponse] = None
    scene_objects: List[SceneObjectResponse] = []
    
    model_config = ConfigDict(from_attributes=True)


class MapProjectListItem(BaseModel):
    id: int
    name: str
    owner_id: UUID
    template_id: Optional[int]
    pack_id: Optional[int]
    is_public: bool
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class SaveProjectRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[List[str]] = Field(default_factory=list)
    is_public: Optional[bool] = None
    