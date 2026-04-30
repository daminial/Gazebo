from io import BytesIO
from typing import List

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession

from src.auth.models import User
from src.core.database import get_db
from src.auth.dependencies import get_current_user
from src.core.storage.dependencies import get_s3_client
from src.core.storage.s3Client import S3Client
from src.core.storage.service import MediaService
from src.map.service import MapTemplateService
from src.map_editor.service import MapEditorService
from src.map_editor.schemas import (
    AssetCreate, AssetPackCreate, MapProjectCreate, MapProjectUpdate,
    MapProjectResponse, MapProjectListItem,
    SceneObjectCreate, SceneObjectUpdate, SceneObjectResponse,
    BackgroundUpdate, BackgroundResponse,
    AssetPackResponse, AssetResponse,
    SaveProjectRequest
)

router = APIRouter(prefix="/map-editor", tags=["map-editor"], redirect_slashes=False)


def get_media_service(
    db: AsyncSession = Depends(get_db),
    s3_client: S3Client = Depends(get_s3_client)
) -> MediaService:
    return MediaService(s3_client=s3_client, db_session=db)


def get_editor_service(
    db: AsyncSession = Depends(get_db),
    media_service: MediaService = Depends(get_media_service)
) -> MapEditorService:
    return MapEditorService(db=db, media_service=media_service)


def get_template_service(
    db: AsyncSession = Depends(get_db),
    media_service: MediaService = Depends(get_media_service)
) -> MapTemplateService:
    return MapTemplateService(db=db, media_service=media_service)


@router.get("/packs", response_model=List[AssetPackResponse])
async def get_asset_packs(
    editor_service: MapEditorService = Depends(get_editor_service)
):
    return await editor_service.get_public_packs()


@router.get("/packs/{pack_id}/assets", response_model=List[AssetResponse])
async def get_pack_assets(
    pack_id: int,
    editor_service: MapEditorService = Depends(get_editor_service)
):
    return await editor_service.get_pack_assets(pack_id)


@router.post("/projects", response_model=MapProjectResponse)
async def create_project(
    data: MapProjectCreate,
    editor_service: MapEditorService = Depends(get_editor_service),
    current_user: User = Depends(get_current_user)
):
    project = await editor_service.create_project(current_user.id, data)
    return await editor_service.to_project_response(project)


@router.get("/projects/my", response_model=List[MapProjectListItem])
async def get_my_projects(
    editor_service: MapEditorService = Depends(get_editor_service),
    current_user: User = Depends(get_current_user)
):
    return await editor_service.get_user_projects(current_user.id)


@router.get("/projects/{project_id}", response_model=MapProjectResponse)
async def get_project(
    project_id: int,
    editor_service: MapEditorService = Depends(get_editor_service)
):
    project = await editor_service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return await editor_service.to_project_response(project)


@router.patch("/projects/{project_id}", response_model=MapProjectResponse)
async def update_project(
    project_id: int,
    data: MapProjectUpdate,
    editor_service: MapEditorService = Depends(get_editor_service),
    current_user: User = Depends(get_current_user)
):
    try:
        project = await editor_service.update_project(project_id, data, current_user.id)
        return await editor_service.to_project_response(project)
    except PermissionError:
        raise HTTPException(status_code=403, detail="Access denied")


@router.delete("/projects/{project_id}")
async def delete_project(
    project_id: int,
    editor_service: MapEditorService = Depends(get_editor_service),
    current_user: User = Depends(get_current_user)
):
    try:
        await editor_service.delete_project(project_id, current_user.id)
        return {"message": "Project deleted"}
    except PermissionError:
        raise HTTPException(status_code=403, detail="Access denied")


@router.post("/projects/{project_id}/objects", response_model=SceneObjectResponse)
async def add_scene_object(
    project_id: int,
    data: SceneObjectCreate,
    editor_service: MapEditorService = Depends(get_editor_service),
    current_user: User = Depends(get_current_user)
):
    try:
        obj = await editor_service.add_scene_object(project_id, data, current_user.id)
        return obj
    except PermissionError:
        raise HTTPException(status_code=403, detail="Access denied")


@router.patch("/projects/objects/{object_id}")
async def update_scene_object(
    object_id: int,
    data: SceneObjectUpdate,
    editor_service: MapEditorService = Depends(get_editor_service),
    current_user: User = Depends(get_current_user)
):
    try:
        await editor_service.update_scene_object(object_id, data, current_user.id)
        return {"ok": True}
    except (ValueError, PermissionError) as e:
        raise HTTPException(status_code=404 if "not found" in str(e) else 403, detail=str(e))


@router.delete("/projects/objects/{object_id}")
async def delete_scene_object(
    object_id: int,
    editor_service: MapEditorService = Depends(get_editor_service),
    current_user: User = Depends(get_current_user)
):
    try:
        await editor_service.delete_scene_object(object_id, current_user.id)
        return {"ok": True}
    except (ValueError, PermissionError) as e:
        raise HTTPException(status_code=404 if "not found" in str(e) else 403, detail=str(e))


@router.patch("/projects/{project_id}/background", response_model=BackgroundResponse)
async def update_background(
    project_id: int,
    data: BackgroundUpdate,
    editor_service: MapEditorService = Depends(get_editor_service),
    current_user: User = Depends(get_current_user)
):
    try:
        await editor_service.update_background(project_id, data, current_user.id)
        project = await editor_service.get_project(project_id)
        response = await editor_service.to_project_response(project)
        return response.background
    except PermissionError:
        raise HTTPException(status_code=403, detail="Access denied")
    
@router.get("/projects/by-template/{template_id}", response_model=MapProjectResponse)
async def get_project_by_template(
    template_id: int,
    editor_service: MapEditorService = Depends(get_editor_service)
):
    project = await editor_service.get_project_by_template(template_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return await editor_service.to_project_response(project)

@router.post("/projects/{project_id}/save")
async def save_project_to_template(
    project_id: int,
    rendered_image: UploadFile = File(...),
    name: str = Form(None),
    description: str = Form(None),
    tags: str = Form(None),
    is_public: str = Form("false"),
    editor_service: MapEditorService = Depends(get_editor_service),
    template_service: MapTemplateService = Depends(get_template_service),
    current_user: User = Depends(get_current_user)
):
    file_data = await rendered_image.read()
    
    request = SaveProjectRequest(
        name=name,
        description=description,
        tags=tags.split(',') if tags else [],
        is_public=is_public.lower() == 'true'
    )
    
    # Убери try-except, пусть ошибка всплывёт
    return await editor_service.save_project_to_template(
        project_id=project_id,
        user_id=current_user.id,
        rendered_image=BytesIO(file_data),
        filename=rendered_image.filename or "map_render.png",
        file_size=len(file_data),
        content_type=rendered_image.content_type or "image/png",
        request=request,
        map_template_service=template_service
    )

@router.post("/packs", response_model=AssetPackResponse)
async def create_pack(
    data: AssetPackCreate,
    editor_service: MapEditorService = Depends(get_editor_service),
    current_user: User = Depends(get_current_user)
):
    pack = await editor_service.create_pack(data, current_user.id)
    return pack


@router.patch("/packs/{pack_id}", response_model=AssetPackResponse)
async def update_pack(
    pack_id: int,
    data: AssetPackCreate,
    editor_service: MapEditorService = Depends(get_editor_service),
    current_user: User = Depends(get_current_user)
):
    return await editor_service.update_pack(pack_id, data, current_user.id)


@router.delete("/packs/{pack_id}")
async def delete_pack(
    pack_id: int,
    editor_service: MapEditorService = Depends(get_editor_service),
    current_user: User = Depends(get_current_user)
):
    await editor_service.delete_pack(pack_id, current_user.id)
    return {"message": "Pack deleted"}


@router.post("/packs/{pack_id}/assets", response_model=AssetResponse)
async def create_asset(
    pack_id: int,
    data: AssetCreate,
    editor_service: MapEditorService = Depends(get_editor_service),
    current_user: User = Depends(get_current_user)
):
    return await editor_service.create_asset(pack_id, data, current_user.id)


@router.delete("/assets/{asset_id}")
async def delete_asset(
    asset_id: int,
    editor_service: MapEditorService = Depends(get_editor_service),
    current_user: User = Depends(get_current_user)
):
    await editor_service.delete_asset(asset_id, current_user.id)
    return {"message": "Asset deleted"}
