from sqlalchemy import (
    Column, String, Boolean, Integer,
    Float, DateTime, ForeignKey, Index, JSON
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from src.core.database import Base


class AssetPack(Base):
    __tablename__ = "asset_packs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    is_public = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User", foreign_keys=[owner_id])
    assets = relationship("Asset", back_populates="pack", cascade="all, delete-orphan")

    __table_args__ = (
        Index('idx_asset_packs_owner_id', 'owner_id'),
        Index('idx_asset_packs_is_public', 'is_public'),
    )


class Asset(Base):
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    pack_id = Column(Integer, ForeignKey("asset_packs.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    image_id = Column(Integer, ForeignKey("images.id", ondelete="CASCADE"), nullable=False)
    default_width = Column(Integer, nullable=False)
    default_height = Column(Integer, nullable=False)
    category = Column(String, nullable=True)
    is_rotatable = Column(Boolean, default=True)
    snap_to_grid = Column(Boolean, default=True)

    image = relationship("Image", foreign_keys=[image_id])
    pack = relationship("AssetPack", back_populates="assets")
    scene_objects = relationship("SceneObject", back_populates="asset")

    __table_args__ = (
        Index('idx_assets_pack_id', 'pack_id'),
        Index('idx_assets_category', 'category'),
    )


class MapProject(Base):
    __tablename__ = "map_projects"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    orientation = Column(String, nullable=False)
    width = Column(Integer, nullable=False)
    height = Column(Integer, nullable=False)
    template_id = Column(Integer, ForeignKey("map_templates.id", ondelete="SET NULL"), nullable=True)
    pack_id = Column(Integer, ForeignKey("asset_packs.id", ondelete="SET NULL"), nullable=True)
    is_public = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    owner = relationship("User", foreign_keys=[owner_id])
    template = relationship("MapTemplate", foreign_keys=[template_id])
    pack = relationship("AssetPack")
    scene_objects = relationship("SceneObject", back_populates="project", cascade="all, delete-orphan")
    background = relationship("BackgroundLayer", uselist=False, back_populates="project", cascade="all, delete-orphan")

    __table_args__ = (
        Index('idx_map_projects_owner_id', 'owner_id'),
        Index('idx_map_projects_template_id', 'template_id'),
        Index('idx_map_projects_updated_at', 'updated_at'),
    )


class BackgroundLayer(Base):
    __tablename__ = "background_layers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("map_projects.id", ondelete="CASCADE"), unique=True, nullable=False)
    grid_data = Column(JSON, nullable=True)
    image_id = Column(Integer, ForeignKey("images.id", ondelete="SET NULL"), nullable=True)

    project = relationship("MapProject", back_populates="background")
    image = relationship("Image", foreign_keys=[image_id])

    __table_args__ = (
        Index('idx_background_layers_project_id', 'project_id'),
    )


class SceneObject(Base):
    __tablename__ = "scene_objects"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("map_projects.id", ondelete="CASCADE"), nullable=False)
    asset_id = Column(Integer, ForeignKey("assets.id", ondelete="CASCADE"), nullable=True)
    x = Column(Float, nullable=False)
    y = Column(Float, nullable=False)
    width = Column(Float, nullable=True)
    height = Column(Float, nullable=True)
    rotation = Column(Float, default=0)
    z_index = Column(Integer, default=0)
    tint_color = Column(String, nullable=True)
    opacity = Column(Float, default=1.0)
    flipped_h = Column(Boolean, default=False)
    flipped_v = Column(Boolean, default=False)
    locked = Column(Boolean, default=False)

    project = relationship("MapProject", back_populates="scene_objects")
    asset = relationship("Asset", back_populates="scene_objects")

    __table_args__ = (
        Index('idx_scene_objects_project_id', 'project_id'),
        Index('idx_scene_objects_asset_id', 'asset_id'),
        Index('idx_scene_objects_z_index', 'z_index'),
    )
    