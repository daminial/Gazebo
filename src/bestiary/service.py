from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from uuid import UUID
from typing import Optional, List, BinaryIO

from src.bestiary.enum import CreatureSize, CreatureType
from src.core.storage.models import Image
from src.core.storage.schemas import ImageCreate, MediaType
from src.core.storage.service import MediaService
from src.bestiary.models import CreatureTemplate
from src.bestiary.exceptions import (
    TemplateNotFoundError,
    TemplatePermissionError,
    ImageNotFoundError
)

class CreatureTemplateService:
    def __init__(self, db: AsyncSession, media_service: Optional[MediaService] = None):
        self.db = db
        self.media_service = media_service

    async def create_creature_template(
        self,
        user_id: UUID,
        name: str,
        file: BinaryIO,
        filename: str,
        file_size: int,
        content_type: str,
        description: Optional[str] = None,
        max_hp: Optional[int] = None,
        ac: Optional[int] = None,
        cr: int = 0,
        size: CreatureSize = CreatureSize.MEDIUM,
        type: CreatureType = CreatureType.HUMANOIDS,
        data: Optional[dict] = None,
        is_public: bool = False,
        caption: Optional[str] = None
    ) -> CreatureTemplate:
        """Создать шаблон существа с загрузкой изображения"""
        if not self.media_service:
            raise RuntimeError("MediaService not provided")

        image_create = ImageCreate(
            filename=filename,
            extension=filename.split('.')[-1],
            mime_type=content_type,
            file_size=file_size,
            type=MediaType.IMAGE,
            is_public=is_public,
            caption=caption or name,
            uploaded_by=user_id,
        )

        image_response = await self.media_service.upload_file(
            file=file,
            file_data=image_create,
            user_id=user_id
        )

        template = CreatureTemplate(
            name=name,
            description=description,
            image_id=image_response.id,
            max_hp=max_hp,
            ac=ac,
            cr=cr,
            size=size,
            type=type,
            data=data or {}
        )

        self.db.add(template)
        await self.db.flush()

        result = await self.db.execute(
            select(CreatureTemplate)
            .filter_by(id=template.id)
            .options(selectinload(CreatureTemplate.image))
        )
        template = result.scalar_one()
        return template

    async def get_template(self, template_id: int) -> CreatureTemplate:
        """Получить шаблон по ID, иначе выбросить исключение"""
        result = await self.db.execute(
            select(CreatureTemplate)
            .filter_by(id=template_id)
            .options(selectinload(CreatureTemplate.image))
        )
        template = result.scalar_one_or_none()
        if not isinstance(template, CreatureTemplate) :
            raise TemplateNotFoundError(f"Template {template_id} not found")
        return template
    
    async def get_all_public_templates(self) -> List[CreatureTemplate]:
        """Получить всех публичных существ"""
        result = await self.db.execute(
            select(CreatureTemplate)
            .join(CreatureTemplate.image)
            .filter(Image.is_public == True)
            .order_by(Image.created_at.desc())
            .options(selectinload(CreatureTemplate.image))
        )
        return list(result.scalars().all())

    async def get_user_templates(self, user_id: UUID) -> List[CreatureTemplate]:
        """Получить все шаблоны пользователя"""
        result = await self.db.execute(
            select(CreatureTemplate)
            .join(CreatureTemplate.image)
            .filter(Image.uploaded_by == user_id) # type: ignore[arg-type]
            .order_by(Image.created_at.desc())
            .options(selectinload(CreatureTemplate.image))
        )
        return list(result.scalars().all())

    async def update_template(
        self,
        template_id: int,
        user_id: UUID,
        **kwargs
    ) -> CreatureTemplate:
        """Обновить шаблон"""
        template = await self.get_template(template_id)

        if template.image.uploaded_by != user_id:
            raise TemplatePermissionError("You can only edit your own templates")

        if 'image_id' in kwargs and kwargs['image_id'] != template.image_id:
            new_image = await self.db.get(Image, kwargs['image_id'])
            if not new_image:
                raise ImageNotFoundError(f"Image {kwargs['image_id']} not found")
            if new_image.uploaded_by != user_id:
                raise TemplatePermissionError("Cannot use this image")

        for key, value in kwargs.items():
            if value is not None and hasattr(template, key):
                setattr(template, key, value)

        return template

    async def delete_template(self, template_id: int, user_id: UUID):
        """Удалить шаблон"""
        template = await self.get_template(template_id)

        if template.image.uploaded_by != user_id:
            raise TemplatePermissionError("You can only delete your own templates")

        await self.db.delete(template)
