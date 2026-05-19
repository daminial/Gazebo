from io import BytesIO
from typing import List, Optional, BinaryIO
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.sql import func

from src.core.storage.schemas import ImageCreate
from src.core.storage.service import MediaService
from src.core.storage.models import Image, MediaType
from src.map.models import MapTemplate
from src.map.service import MapTemplateService
from src.map_editor.models import MapProject, SceneObject, BackgroundLayer, AssetPack, Asset
from src.map_editor.schemas import (
    AssetCreate, AssetPackCreate, MapProjectCreate, MapProjectUpdate, MapProjectResponse,
    SceneObjectCreate, SceneObjectUpdate, SceneObjectResponse,
    BackgroundUpdate, BackgroundResponse,
    AssetPackResponse, AssetResponse, SaveProjectRequest
)


class MapEditorService:
    def __init__(self, db: AsyncSession, media_service: MediaService):
        self.db = db
        self.media_service = media_service

    async def get_public_packs(self) -> List[AssetPackResponse]:
        result = await self.db.execute(
            select(AssetPack)
            .filter(AssetPack.is_public == True)
            .options(selectinload(AssetPack.assets))
        )
        packs = result.scalars().all()
        
        return [
            AssetPackResponse(
                id=p.id,
                name=p.name,
                description=p.description,
                owner_id=p.owner_id,
                is_public=p.is_public,
                created_at=p.created_at,
                assets_count=len(p.assets)
            )
            for p in packs
        ]

    async def get_pack_assets(self, pack_id: int) -> List[AssetResponse]:
        result = await self.db.execute(
            select(Asset)
            .filter(Asset.pack_id == pack_id)
            .options(selectinload(Asset.image))
        )
        assets = result.scalars().all()
        
        response_list = []
        for asset in assets:
            image_url = await self.media_service.get_image_url(asset.image)
            response_list.append(
                AssetResponse(
                    id=asset.id,
                    pack_id=asset.pack_id,
                    name=asset.name,
                    image_id=asset.image_id,
                    image_url=image_url,
                    default_width=asset.default_width,
                    default_height=asset.default_height,
                    category=asset.category,
                    is_rotatable=asset.is_rotatable,
                    snap_to_grid=asset.snap_to_grid
                )
            )
        
        return response_list

    async def create_project(
        self,
        user_id: UUID,
        data: MapProjectCreate
    ) -> MapProject:
        project = MapProject(
            name=data.name,
            owner_id=user_id,
            pack_id=data.pack_id,
            orientation=data.orientation,
            width=data.width,
            height=data.height,
            is_public=data.is_public
        )

        background = BackgroundLayer(project=project, grid_data=[])

        self.db.add(project)
        await self.db.flush()

        return await self.get_project(project.id)

    async def get_project(self, project_id: int) -> Optional[MapProject]:
        result = await self.db.execute(
            select(MapProject)
            .filter_by(id=project_id)
            .options(
                selectinload(MapProject.scene_objects)
                .selectinload(SceneObject.asset)
                .selectinload(Asset.image),
                selectinload(MapProject.background)
                .selectinload(BackgroundLayer.image),
                selectinload(MapProject.pack)
            )
        )
        return result.scalar_one_or_none()

    async def get_user_projects(self, user_id: UUID) -> List[MapProject]:
        result = await self.db.execute(
            select(MapProject)
            .filter_by(owner_id=user_id)
            .options(selectinload(MapProject.scene_objects))
            .order_by(MapProject.updated_at.desc())
        )
        return list(result.scalars().all())

    async def update_project(
        self,
        project_id: int,
        data: MapProjectUpdate,
        user_id: UUID
    ) -> MapProject:
        project = await self.get_project(project_id)
        if not project or project.owner_id != user_id:
            raise PermissionError("Access denied")

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            if hasattr(project, key):
                setattr(project, key, value)

        await self.db.flush()
        return await self.get_project(project_id)

    async def delete_project(self, project_id: int, user_id: UUID):
        project = await self.get_project(project_id)
        if not project or project.owner_id != user_id:
            raise PermissionError("Access denied")

        await self.db.delete(project)
        await self.db.flush()

    async def get_project_by_template(self, template_id: int) -> Optional[MapProject]:
        result = await self.db.execute(
            select(MapProject)
            .filter_by(template_id=template_id)
            .options(
                selectinload(MapProject.scene_objects)
                .selectinload(SceneObject.asset)
                .selectinload(Asset.image),
                selectinload(MapProject.background)
                .selectinload(BackgroundLayer.image),
                selectinload(MapProject.pack)
            )
        )
        return result.scalar_one_or_none()

    async def add_scene_object(
        self,
        project_id: int,
        data: SceneObjectCreate,
        user_id: UUID
    ) -> SceneObject:
        project = await self.get_project(project_id)
        if not project or project.owner_id != user_id:
            raise PermissionError("Access denied")

        obj = SceneObject(
            project_id=project_id,
            asset_id=data.asset_id,
            x=data.x,
            y=data.y,
            width=data.width,
            height=data.height,
            rotation=data.rotation,
            z_index=data.z_index,
            tint_color=data.tint_color,
            opacity=data.opacity,
            flipped_h=data.flipped_h,
            flipped_v=data.flipped_v,
            locked=data.locked
        )

        self.db.add(obj)
        await self.db.flush()

        await self.db.execute(
            update(MapProject)
            .where(MapProject.id == project_id)
            .values(updated_at=func.now())
        )

        return obj

    async def update_scene_object(
        self,
        object_id: int,
        data: SceneObjectUpdate,
        user_id: UUID
    ):
        obj = await self.db.get(SceneObject, object_id)
        if not obj:
            raise ValueError("Object not found")

        project = await self.db.get(MapProject, obj.project_id)
        if not project or project.owner_id != user_id:
            raise PermissionError("Access denied")

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            if hasattr(obj, key):
                setattr(obj, key, value)

        await self.db.flush()

        await self.db.execute(
            update(MapProject)
            .where(MapProject.id == obj.project_id)
            .values(updated_at=func.now())
        )

    async def delete_scene_object(self, object_id: int, user_id: UUID):
        obj = await self.db.get(SceneObject, object_id)
        if not obj:
            raise ValueError("Object not found")

        project = await self.db.get(MapProject, obj.project_id)
        if not project or project.owner_id != user_id:
            raise PermissionError("Access denied")

        await self.db.delete(obj)
        await self.db.flush()

        await self.db.execute(
            update(MapProject)
            .where(MapProject.id == obj.project_id)
            .values(updated_at=func.now())
        )

    async def update_background(
        self,
        project_id: int,
        data: BackgroundUpdate,
        user_id: UUID
    ):
        project = await self.get_project(project_id)
        if not project or project.owner_id != user_id:
            raise PermissionError("Access denied")

        background = project.background
        if not background:
            background = BackgroundLayer(project_id=project_id, grid_data=[])
            self.db.add(background)

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            if hasattr(background, key):
                setattr(background, key, value)

        await self.db.flush()

        await self.db.execute(
            update(MapProject)
            .where(MapProject.id == project_id)
            .values(updated_at=func.now())
        )

    async def save_project_to_template(
        self,
        project_id: int,
        user_id: UUID,
        rendered_image: BinaryIO,
        filename: str,
        file_size: int,
        content_type: str,
        request: SaveProjectRequest,
        map_template_service: MapTemplateService
    ):
        project = await self.get_project(project_id)
        if not project or project.owner_id != user_id:
            raise PermissionError("Access denied")

        if project.template_id:
            # Загружаем шаблон с тегами заранее
            result = await self.db.execute(
                select(MapTemplate)
                .filter_by(id=project.template_id)
                .options(selectinload(MapTemplate.tags))
            )
            template = result.scalar_one_or_none()
            
            if template and template.owner_id == user_id:
                image_create = ImageCreate(
                    filename=filename,
                    extension=filename.split('.')[-1] if '.' in filename else 'png',
                    mime_type=content_type,
                    file_size=file_size,
                    type=MediaType.IMAGE,
                    is_public=request.is_public if request.is_public is not None else project.is_public,
                    caption=request.name or project.name,
                    uploaded_by=user_id,
                )
                
                image_response = await self.media_service.upload_file(
                    file=rendered_image,
                    file_data=image_create,
                    user_id=user_id
                )
                
                template.image_id = image_response.id
                template.name = request.name or project.name
                if request.description is not None:
                    template.description = request.description
                template.is_public = request.is_public if request.is_public is not None else project.is_public
                
                if request.tags is not None:
                    # Очищаем старые теги и добавляем новые
                    template.tags.clear()
                    tag_objects = await map_template_service._get_or_create_tags(request.tags)
                    for tag in tag_objects:
                        template.tags.append(tag)
                
                await self.db.flush()
                
                # Перезагружаем с картинкой и тегами
                result = await self.db.execute(
                    select(MapTemplate)
                    .filter_by(id=template.id)
                    .options(
                        selectinload(MapTemplate.image).selectinload(Image.thumbnail),
                        selectinload(MapTemplate.tags)
                    )
                )
                template = result.scalar_one()
                
                return await map_template_service.to_response(template)
        
        template = await map_template_service.create_map_template(
            user_id=user_id,
            name=request.name or project.name,
            file=rendered_image,
            filename=filename,
            file_size=file_size,
            content_type=content_type,
            description=request.description or f"Map project: {project.name}",
            is_public=request.is_public if request.is_public is not None else project.is_public,
            tags=request.tags or []
        )

        project.template_id = template.id
        await self.db.flush()

        return await map_template_service.to_response(template)

    async def to_project_response(self, project: MapProject) -> MapProjectResponse:
        scene_objects = []
        for obj in project.scene_objects:
            image_url = None
            asset_name = None
            if obj.asset:
                asset_name = obj.asset.name
                if obj.asset.image:
                    image_url = await self.media_service.get_image_url(obj.asset.image)
            
            scene_objects.append(
                SceneObjectResponse(
                    id=obj.id,
                    asset_id=obj.asset_id,
                    asset_name=asset_name,
                    image_url=image_url,
                    x=obj.x,
                    y=obj.y,
                    width=obj.width,
                    height=obj.height,
                    rotation=obj.rotation,
                    z_index=obj.z_index,
                    tint_color=obj.tint_color,
                    opacity=obj.opacity,
                    flipped_h=obj.flipped_h,
                    flipped_v=obj.flipped_v,
                    locked=obj.locked
                )
            )

        background = None
        if project.background:
            bg_image_url = None
            if project.background.image:
                bg_image_url = await self.media_service.get_image_url(project.background.image)
            
            background = BackgroundResponse(
                grid_data=project.background.grid_data,
                image_id=project.background.image_id,
                image_url=bg_image_url
            )

        return MapProjectResponse(
            id=project.id,
            name=project.name,
            owner_id=project.owner_id,
            orientation=project.orientation,
            width=project.width,
            height=project.height,
            pack_id=project.pack_id,
            template_id=project.template_id,
            is_public=project.is_public,
            created_at=project.created_at,
            updated_at=project.updated_at,
            background=background,
            scene_objects=scene_objects
        )
    
    # Ассеты    
    async def create_pack(self, data: AssetPackCreate, user_id: UUID) -> AssetPack:
        pack = AssetPack(
            name=data.name,
            description=data.description,
            owner_id=user_id,
            is_public=data.is_public
        )
        self.db.add(pack)
        await self.db.flush()
        return pack

    async def update_pack(self, pack_id: int, data: AssetPackCreate, user_id: UUID) -> AssetPack:
        pack = await self.db.get(AssetPack, pack_id)
        if not pack or pack.owner_id != user_id:
            raise PermissionError("Access denied")
        
        for key, value in data.model_dump(exclude_unset=True).items():
            if hasattr(pack, key):
                setattr(pack, key, value)
        
        await self.db.flush()
        return pack

    async def delete_pack(self, pack_id: int, user_id: UUID, is_moderator: bool = False):
        pack = await self.db.get(AssetPack, pack_id)
        if is_moderator:
            if not pack.is_public:
                raise PermissionError("Модератор может удалять только публичные паки ассетов")
        elif pack.owner_id != user_id:
            raise PermissionError("Нет доступа")
        
        await self.db.delete(pack)
        await self.db.flush()

    async def create_asset(self, pack_id: int, data: AssetCreate, user_id: UUID) -> Asset:
        pack = await self.db.get(AssetPack, pack_id)
        if not pack or pack.owner_id != user_id:
            raise PermissionError("Access denied")
        
        asset = Asset(
            pack_id=pack_id,
            name=data.name,
            image_id=data.image_id,
            default_width=data.default_width,
            default_height=data.default_height,
            category=data.category,
            is_rotatable=data.is_rotatable,
            snap_to_grid=data.snap_to_grid
        )
        
        self.db.add(asset)
        await self.db.flush()
        return asset

    async def delete_asset(self, asset_id: int, user_id: UUID):
        asset = await self.db.get(Asset, asset_id)
        if not asset:
            raise ValueError("Asset not found")
        
        pack = await self.db.get(AssetPack, asset.pack_id)
        if not pack or pack.owner_id != user_id:
            raise PermissionError("Access denied")
        
        await self.db.delete(asset)
        await self.db.flush()