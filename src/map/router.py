from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from src.auth.models import User
from src.core.database import get_db
from src.auth.dependencies import get_current_user
from src.core.storage.dependencies import get_s3_client
from src.core.storage.s3Client import S3Client
from src.core.storage.service import MediaService
from src.map.models import MapTemplate
from src.map.schemas import (
    MapTemplateCreate,
    MapTemplateUpdate,
    MapTemplateResponse,
    MapTemplateListItem
)
from src.map.service import MapTemplateService

router = APIRouter(prefix="/map-templates", tags=["map-templates"], redirect_slashes=False)


@router.post("", response_model=MapTemplateResponse)
async def create_map_template(
        file: UploadFile = File(...),
        data: MapTemplateCreate = Depends(),
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user),
        s3_client: S3Client = Depends(get_s3_client)
):
    file_data = await file.read()
    file_bytes = BytesIO(file_data)

    media_service = MediaService(s3_client=s3_client, db_session=db)
    template_service = MapTemplateService(db=db, media_service=media_service)

    template = await template_service.create_map_template(
        user_id=current_user.id,
        name=data.name,
        file=file_bytes,
        filename=file.filename,
        file_size=len(file_data),
        content_type=file.content_type,
        description=data.description,
        is_public=data.is_public,
        caption=data.caption
    )

    return template


@router.get("/my", response_model=List[MapTemplateListItem])
async def get_my_templates(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Получить мои шаблоны карт"""
    template_service = MapTemplateService(db=db, media_service=None)
    templates = await template_service.get_user_templates(current_user.id)
    return templates


@router.get("/{template_id}", response_model=MapTemplateResponse)
async def get_map_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Получить шаблон карты по ID"""
    template_service = MapTemplateService(db=db, media_service=None)
    template = await template_service.get_template(template_id)
    if not isinstance(template, MapTemplate):
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.put("/{template_id}", response_model=MapTemplateResponse)
async def update_map_template(
    template_id: int,
    template_data: MapTemplateUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Обновить шаблон карты"""
    template_service = MapTemplateService(db=db, media_service=None)
    update_data = template_data.model_dump(exclude_unset=True, exclude={"is_public"})
    template = await template_service.update_template(
        template_id=template_id,
        user_id=current_user.id,
        **update_data
    )
    return template


@router.delete("/{template_id}")
async def delete_map_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Удалить шаблон карты"""
    template_service = MapTemplateService(db=db, media_service=None)
    await template_service.delete_template(template_id, current_user.id)
    return {"message": "Шаблон карты удален"}
