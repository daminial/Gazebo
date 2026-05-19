from io import BytesIO
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession

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
from src.map.exceptions import (
    TemplateNotFoundError,
    TemplatePermissionError,
    ImageNotFoundError
)

router = APIRouter(prefix="/map-templates", tags=["map-templates"], redirect_slashes=False)


@router.post("", response_model=MapTemplateResponse)
async def create_map_template(
        file: UploadFile = File(...),
        data: MapTemplateCreate = Depends(),
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user),
        s3_client: S3Client = Depends(get_s3_client)
):
    """Создать новый шаблон карты"""
    file_data = await file.read()
    file_bytes = BytesIO(file_data)

    media_service = MediaService(s3_client=s3_client, db_session=db)
    template_service = MapTemplateService(db=db, media_service=media_service)

    try:
        template = await template_service.create_map_template(
            user_id=current_user.id,
            name=data.name,
            file=file_bytes,
            filename=file.filename or "map_template.png",
            file_size=len(file_data),
            content_type=file.content_type or "image/png",
            description=data.description,
            is_public=data.is_public,
            caption=data.caption,
            tags=data.tags
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    return await template_service.to_response(template)


@router.get("/public", response_model=List[MapTemplateListItem])
async def get_public_templates(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    tag: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    s3_client: S3Client = Depends(get_s3_client),
):
    """Получить публичные шаблоны карт"""
    template_service = MapTemplateService(db=db, media_service=None)
    templates = await template_service.get_public_templates(
        skip=skip,
        limit=limit,
        tag=tag
    )
    
    media_service = MediaService(s3_client=s3_client, db_session=db)
    result = []
    for template in templates:
        item_data = {
            "id": template.id,
            "name": template.name,
            "description": template.description,
            "image_id": template.image_id,
            "owner_id": template.owner_id,
            "is_public": template.is_public,
            "rating": template.rating,
            "votes": template.votes,
            "created_at": template.created_at,
            "tags": [tag.name for tag in template.tags] if template.tags else [],
            "owner_username": template.owner.username if template.owner else None
        }
        if template.image:
            item_data["image_url"] = await media_service.get_image_url(template.image)
        item = MapTemplateListItem(**item_data)
        result.append(item) 

    return result


@router.get("/my", response_model=List[MapTemplateListItem])
async def get_my_templates(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    s3_client: S3Client = Depends(get_s3_client)
):
    """Получить мои шаблоны карт"""
    template_service = MapTemplateService(db=db, media_service=None)
    templates = await template_service.get_user_templates(current_user.id)
    
    media_service = MediaService(s3_client=s3_client, db_session=db)
    result = []
    for template in templates:
        item_data = {
            "id": template.id,
            "name": template.name,
            "description": template.description,
            "image_id": template.image_id,
            "owner_id": template.owner_id,
            "is_public": template.is_public,
            "rating": template.rating,
            "votes": template.votes,
            "created_at": template.created_at,
            "tags": [tag.name for tag in template.tags] if template.tags else [],
            "owner_username": template.owner.username if template.owner else None
        }
        if template.image:
            item_data["image_url"] = await media_service.get_image_url(template.image)
        item = MapTemplateListItem(**item_data)
        result.append(item)

    return result


@router.get("/{template_id}", response_model=MapTemplateResponse)
async def get_map_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    s3_client: S3Client = Depends(get_s3_client)
):
    """Получить шаблон карты по ID"""
    media_service = MediaService(s3_client=s3_client, db_session=db)
    template_service = MapTemplateService(db=db, media_service=media_service)
    
    template = await template_service.get_template(template_id)
    
    if not isinstance(template, MapTemplate):
        raise HTTPException(status_code=404, detail="Template not found")
    
    return await template_service.to_response(template)


@router.patch("/{template_id}", response_model=MapTemplateResponse)
async def update_map_template(
    template_id: int,
    template_data: MapTemplateUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    s3_client: S3Client = Depends(get_s3_client)
):
    """Частично обновить шаблон карты"""
    media_service = MediaService(s3_client=s3_client, db_session=db)
    template_service = MapTemplateService(db=db, media_service=media_service)
    
    try:
        update_data = template_data.model_dump(exclude_unset=True)
        
        template = await template_service.update_template(
            template_id=template_id,
            user_id=current_user.id,
            **update_data
        )
    except TemplateNotFoundError:
        raise HTTPException(status_code=404, detail="Template not found")
    except TemplatePermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ImageNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    return await template_service.to_response(template)


@router.patch("/{template_id}/rate", response_model=MapTemplateResponse)
async def rate_map_template(
    template_id: int,
    rating: float = Query(..., ge=0.5, le=10),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    s3_client: S3Client = Depends(get_s3_client)
):
    media_service = MediaService(s3_client=s3_client, db_session=db)
    template_service = MapTemplateService(db=db, media_service=media_service)
    
    try:
        template = await template_service.vote_template(
            template_id=template_id,
            user_id=current_user.id,
            rating=rating
        )
    except TemplateNotFoundError:
        raise HTTPException(status_code=404, detail="Template not found")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    return await template_service.to_response(template)


@router.delete("/{template_id}")
async def delete_map_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Удалить шаблон карты"""
    template_service = MapTemplateService(db=db, media_service=None)
    is_moderator = await template_service.is_moderator(current_user)
    
    try:
        await template_service.delete_template(template_id, current_user.id, is_moderator)
    except TemplateNotFoundError:
        raise HTTPException(status_code=404, detail="Template not found")
    except TemplatePermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    
    return {"message": "Шаблон карты удален"}
