from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import Optional, List, BinaryIO

from sqlalchemy.orm import selectinload

from src.core.storage.schemas import ImageCreate, MediaType
from src.core.storage.service import MediaService
from src.map.models import MapTemplate
from src.map.exceptions import (
    TemplateNotFoundError,
    TemplatePermissionError,
    ImageNotFoundError
)
from src.core.storage.models import Image


class MapTemplateService:
    def __init__(self, db: AsyncSession, media_service: Optional[MediaService] = None):
        self.db = db
        self.media_service = media_service

    async def create_map_template(
            self,
            user_id: UUID,
            name: str,
            file: BinaryIO,
            filename: str,
            file_size: int,
            content_type: str,
            description: Optional[str] = None,
            is_public: bool = False,
            caption: Optional[str] = None
    ) -> MapTemplate:
        """Создать шаблон карты с загрузкой изображения"""

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

        template = MapTemplate(
            name=name,
            description=description,
            image_id=image_response.id,
        )

        self.db.add(template)
        await self.db.commit()
        await self.db.refresh(template)

        result = await self.db.execute(
            select(MapTemplate)
            .filter_by(id=template.id)
            .options(selectinload(MapTemplate.image))
        )
        template = result.scalar_one()
        return template

    async def get_template(self, template_id: int) -> Optional[MapTemplate]:
        """Получить шаблон по ID"""
        result = await self.db.execute(
            select(MapTemplate)
            .filter_by(id=template_id)
            .options(selectinload(MapTemplate.image))
        )
        return result.scalar_one_or_none()

    async def get_user_templates(self, user_id: UUID) -> List[MapTemplate]:
        """Получить все шаблоны пользователя (через uploaded_by)"""
        result = await self.db.execute(
            select(MapTemplate)
            .join(MapTemplate.image)
            .filter(Image.uploaded_by == user_id) # type: ignore[arg-type]
            .order_by(Image.created_at.desc())
            .options(selectinload(MapTemplate.image))
            )
        return list(result.scalars().all())

    async def update_template(
            self,
            template_id: int,
            user_id: UUID,
            **kwargs
    ) -> MapTemplate:
        """Обновить шаблон"""
        template = await self.get_template(template_id)
        if not isinstance(template, MapTemplate):
            raise TemplateNotFoundError(template_id)

        if template.image.uploaded_by != user_id:
            raise TemplatePermissionError("Только владелец может редактировать шаблон")

        if 'image_id' in kwargs and kwargs['image_id'] != template.image_id:
            new_image = await self.db.get(Image, kwargs['image_id'])
            if not new_image:
                raise ImageNotFoundError(f"Изображение {kwargs['image_id']} не найдено")

        for key, value in kwargs.items():
            if value is not None and hasattr(template, key):
                setattr(template, key, value)

        await self.db.commit()

        result = await self.db.execute(
            select(MapTemplate)
            .filter_by(id=template.id)
            .options(selectinload(MapTemplate.image))
        )
        template = result.scalar_one()
        return template

    async def delete_template(self, template_id: int, user_id: UUID):
        """Удалить шаблон"""
        template = await self.get_template(template_id)
        if not isinstance(template, MapTemplate):
            raise TemplateNotFoundError(template_id)

        if template.image.uploaded_by != user_id:
            raise TemplatePermissionError("You can only delete your own templates")

        await self.db.delete(template)
        await self.db.commit()
