from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import Optional, List, BinaryIO

from sqlalchemy.orm import selectinload

from src.core.storage.schemas import ImageCreate, MediaType
from src.core.storage.service import MediaService
from src.map.models import MapTemplate, Tag
from src.map.exceptions import (
    TemplateNotFoundError,
    TemplatePermissionError,
    ImageNotFoundError
)
from src.core.storage.models import Image
from src.map.schemas import MapTemplateResponse


class MapTemplateService:
    def __init__(self, db: AsyncSession, media_service: Optional[MediaService] = None):
        self.db = db
        self.media_service = media_service

    async def to_response(
        self, 
        template: MapTemplate
    ) -> MapTemplateResponse:
        """Конвертировать SQLAlchemy модель в Pydantic схему"""
        image_url = None
        if template.image and self.media_service:
            image_url = await self.media_service.get_image_url(template.image)
        
        tag_names = [tag.name for tag in template.tags] if template.tags else None
        
        return MapTemplateResponse(
            id=template.id,
            name=template.name,
            description=template.description,
            owner_id=template.owner_id,
            image_id=template.image_id,
            image=template.image,
            image_url=image_url,
            is_public=template.is_public,
            rating=template.rating,
            votes=template.votes,
            created_at=template.created_at,
            updated_at=template.updated_at,
            tags=tag_names
        )
    
    async def to_response_list(self, templates: List[MapTemplate]) -> List[MapTemplateResponse]:
        """Конвертировать список моделей в Pydantic схемы"""
        return [await self.to_response(template) for template in templates]

    async def _get_or_create_tags(self, tag_names: List[str]) -> List[Tag]:
        """Получить существующие теги или создать новые"""
        tags = []
        for name in tag_names:
            name = name.strip().lower()
            if not name:
                continue
            result = await self.db.execute(
                select(Tag).filter(Tag.name == name)
            )
            tag = result.scalar_one_or_none()
            
            if not tag:
                tag = Tag(name=name)
                self.db.add(tag)
                await self.db.flush()
            
            tags.append(tag)
        
        return tags

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
            caption: Optional[str] = None,
            tags: Optional[List[str]] = None
    ) -> MapTemplate:
        """Создать шаблон карты с загрузкой изображения"""

        image_create = ImageCreate(
            filename=filename,
            extension=filename.split('.')[-1] if '.' in filename else 'png',
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
            owner_id=user_id,
            is_public=is_public,
        )

        if tags:
            tag_objects = await self._get_or_create_tags(tags)
            template.tags = tag_objects

        self.db.add(template)
        await self.db.flush()

        result = await self.db.execute(
            select(MapTemplate)
            .filter_by(id=template.id)
            .options(
                selectinload(MapTemplate.image).selectinload(Image.thumbnail),
                selectinload(MapTemplate.tags)
            )
        )
        return result.scalar_one()

    async def get_template(self, template_id: int) -> Optional[MapTemplate]:
        """Получить шаблон по ID"""
        result = await self.db.execute(
            select(MapTemplate)
            .filter_by(id=template_id)
            .options(
                selectinload(MapTemplate.image).selectinload(Image.thumbnail),
                selectinload(MapTemplate.tags)
            )
        )
        return result.scalar_one_or_none()

    async def get_user_templates(self, user_id: UUID) -> List[MapTemplate]:
        """Получить все шаблоны пользователя"""
        result = await self.db.execute(
            select(MapTemplate)
            .filter(MapTemplate.owner_id == user_id)
            .order_by(MapTemplate.created_at.desc())
            .options(selectinload(MapTemplate.image))
        )
        return list(result.scalars().all())

    async def get_public_templates(
        self,
        skip: int = 0,
        limit: int = 20,
        tag: Optional[str] = None
    ) -> List[MapTemplate]:
        """Получить публичные шаблоны с возможностью фильтрации по тегу"""
        query = (
            select(MapTemplate)
            .filter(MapTemplate.is_public == True)
            .options(selectinload(MapTemplate.image))
        )
        
        if tag:
            query = query.join(MapTemplate.tags).filter(Tag.name == tag.lower())
        
        query = query.order_by(MapTemplate.rating.desc(), MapTemplate.votes.desc())
        query = query.offset(skip).limit(limit)
        
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def update_template(
            self,
            template_id: int,
            user_id: UUID,
            **kwargs
    ) -> MapTemplate:
        """Обновить шаблон"""
        template = await self.db.execute(
            select(MapTemplate)
            .filter_by(id=template_id)
            .options(
                selectinload(MapTemplate.image).selectinload(Image.thumbnail),
                selectinload(MapTemplate.tags)
            )
        )
        template = template.scalar_one_or_none()
            
        if not isinstance(template, MapTemplate):
            raise TemplateNotFoundError(template_id)

        if template.owner_id != user_id:
            raise TemplatePermissionError("Только владелец может редактировать шаблон")

        if 'image_id' in kwargs and kwargs['image_id'] is not None:
            if kwargs['image_id'] != template.image_id:
                new_image = await self.db.get(Image, kwargs['image_id'])
                if not new_image:
                    raise ImageNotFoundError(f"Изображение {kwargs['image_id']} не найдено")

        tags = kwargs.pop('tags', None)
        
        for key, value in kwargs.items():
            if value is not None and hasattr(template, key):
                setattr(template, key, value)

        if tags is not None:
            template.tags = await self._get_or_create_tags(tags)

        await self.db.refresh(template)
        return template

    async def delete_template(self, template_id: int, user_id: UUID):
        """Удалить шаблон"""
        template = await self.get_template(template_id)
        if not isinstance(template, MapTemplate):
            raise TemplateNotFoundError(template_id)

        if template.owner_id != user_id:
            raise TemplatePermissionError("You can only delete your own templates")

        await self.db.delete(template)
        await self.db.flush()

    async def vote_template(
        self,
        template_id: int,
        user_id: UUID,
        rating: float
    ) -> MapTemplate:
        """Проголосовать за шаблон (упрощенная версия без проверки повторного голосования)"""
        template = await self.get_template(template_id)
        if not template:
            raise TemplateNotFoundError(template_id)
        
        if rating < 1 or rating > 5:
            raise ValueError("Рейтинг должен быть от 1 до 5")
        
        total_rating = float(template.rating) * template.votes
        template.votes += 1
        template.rating = round((total_rating + rating) / template.votes, 1)
        
        await self.db.flush()
        
        await self.db.refresh(template)
        
        return template