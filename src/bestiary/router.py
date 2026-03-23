from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from io import BytesIO

from src.auth.dependencies import get_current_user
from src.auth.models import User
from src.bestiary.dependencies import json_form
from src.core.database import get_db
from src.core.storage.dependencies import get_s3_client
from src.core.storage.s3Client import S3Client
from src.core.storage.service import MediaService
from src.bestiary import service
from src.bestiary.schemas import (
    CreatureTemplateCreate,
    CreatureTemplateUpdate,
    CreatureTemplateResponse,
    CreatureTemplateListItem
)
from src.bestiary.exceptions import TemplateNotFoundError, TemplatePermissionError

router = APIRouter(prefix="/bestiary/templates", tags=["bestiary"], redirect_slashes=False)

@router.post("", response_model=CreatureTemplateResponse)
async def create_creature_template(
    file: UploadFile = File(...),
    model_data: CreatureTemplateCreate = Depends(json_form(CreatureTemplateCreate)),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    s3_client: S3Client = Depends(get_s3_client)
):
    """Создать шаблон существа с загрузкой изображения"""
    file_data = await file.read()
    file_bytes = BytesIO(file_data)

    media_service = MediaService(s3_client=s3_client, db_session=db)
    template_service = service.CreatureTemplateService(db=db, media_service=media_service)

    template = await template_service.create_creature_template(
        user_id=current_user.id,
        name=model_data.name,
        file=file_bytes,
        filename=file.filename,
        file_size=len(file_data),
        content_type=file.content_type,
        description=model_data.description,
        max_hp=model_data.max_hp,
        ac=model_data.ac,
        cr=model_data.cr,
        size=model_data.size,
        type=model_data.type,
        data=model_data.data,
        is_public=model_data.is_public,
        caption=model_data.caption
    )
    return template

@router.get("/my", response_model=List[CreatureTemplateListItem])
async def get_my_templates(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Получить мои шаблоны существ"""
    template_service = service.CreatureTemplateService(db=db)
    templates = await template_service.get_user_templates(current_user.id)
    return templates

@router.get("/{template_id}", response_model=CreatureTemplateResponse)
async def get_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Получить шаблон по ID"""
    template_service = service.CreatureTemplateService(db=db)
    template = await template_service.get_template(template_id)
    return template

@router.put("/{template_id}", response_model=CreatureTemplateResponse)
async def update_template(
    template_id: int,
    template_data: CreatureTemplateUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    template_service = service.CreatureTemplateService(db=db)
    template = await template_service.update_template(
        template_id=template_id,
        user_id=current_user.id,
        **template_data.model_dump(exclude_unset=True, exclude={"is_public"})
    )
    return template

@router.delete("/{template_id}")
async def delete_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Удалить шаблон"""
    template_service = service.CreatureTemplateService(db=db)
    try:
        await template_service.delete_template(template_id, current_user.id)
    except TemplateNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except TemplatePermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    return {"message": "Template deleted"}
