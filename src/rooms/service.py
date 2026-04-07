from io import BytesIO

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import Optional, List
from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import joinedload, selectinload

from src.bestiary.schemas import RoomTokenCreate
from src.core.storage.models import Image
from src.core.storage.s3Client import S3Client
from src.core.storage.schemas import ImageCreate, MediaType
from src.core.storage.service import MediaService
from src.map.schemas import RoomMapListItem
from src.rooms.exceptions import RoomPermissionError, RoomAccessError
from src.rooms.models import Room, RoomUsers, RoomRole, RoomSettings, RoomPage, ChatMessage
from src.auth.models import User
from src.map.models import RoomMap, MapTemplate
from src.bestiary.models import RoomToken, CreatureTemplate, TokenType
from src.rooms.schemas import RoomUserListItem, RoomSettingsCreate, RoomSettingsUpdate, RoomPageCreate, RoomPageUpdate, ChatMessageCreate, ChatMessageResponse, ChatMessageListResponse
from sqlalchemy import select, func, text

class RoomService:
    def __init__(self, db: AsyncSession, media_service: Optional[MediaService] = None):
        self.media_service = media_service
        self.db = db

    async def _upload_image_file(
            self,
            file: UploadFile,
            user_id: UUID,
            caption: str,
            s3_client: S3Client
    ) -> int:
        """Загрузить файл изображения через MediaService и вернуть ID"""
        file_data = await file.read()
        file_bytes = BytesIO(file_data)

        image_create = ImageCreate(
            filename=file.filename.rsplit('.', 1)[0],
            extension=file.filename.split('.')[-1],
            mime_type=file.content_type,
            file_size=len(file_data),
            type=MediaType.IMAGE,
            is_public=True,
            caption=caption,
            uploaded_by=user_id,
        )

        media_service = MediaService(s3_client=s3_client, db_session=self.db)
        image_response = await media_service.upload_file(
            file=file_bytes,
            file_data=image_create,
            user_id=user_id
        )

        return image_response.id

    async def create_room(self, name: str, image_id: int, user: User) -> Room:
        """Создать новую комнату"""
        room = Room(
            name=name,
            image_id=image_id,
            owner_id=user.id
        )
        self.db.add(room)
        await self.db.flush()

        room_user = RoomUsers(
            room_id=room.id,
            user_id=user.id,
            room_role=RoomRole.DM
        )
        self.db.add(room_user)

        room_settings = RoomSettings(
            room_id=room.id
        )
        self.db.add(room_settings)

        await self.db.flush()

        # Загружаем комнату со всеми relationships
        room = await self.get_room(room.id)
        return room

    async def get_user_rooms(self, user: User) -> List[Room]:
        """Получить все комнаты пользователя"""
        result = await self.db.execute(
            select(Room)
            .options(
                joinedload(Room.image),
                selectinload(Room.settings),
                selectinload(Room.pages)
            )
            .join(RoomUsers)
            .filter_by(user_id=user.id)
            .order_by(Room.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_room(self, room_id: UUID) -> Room:
        """Получить комнату по ID с загрузкой изображения, настроек и страниц"""
        result = await self.db.execute(
            select(Room)
            .options(
                joinedload(Room.image),
                selectinload(Room.settings),
                selectinload(Room.pages)
            )
            .filter_by(id=room_id)
        )
        room = result.scalar_one_or_none()
        return room

    async def update_room(self, room_id: UUID, data: dict, user: User) -> Room:
        """Обновить комнату"""
        result = await self.db.execute(
            select(Room)
            .options(
                joinedload(Room.image),
                selectinload(Room.settings),
                selectinload(Room.pages)
            )
            .filter_by(id=room_id)
        )
        room = result.scalar_one_or_none()

        if not room or (room.owner_id != user.id and not await self.is_dm(room_id, user.id)):
            raise RoomPermissionError("Только DM может редактировать комнату")

        for key, value in data.items():
            setattr(room, key, value)

        return room

    async def delete_room(self, room_id: UUID, user: User):
        """Удалить комнату"""
        room = await self.get_room(room_id)

        if room.owner_id != user.id:
            raise RoomPermissionError("Только владелец может удалить комнату")

        await self.db.delete(room)

    async def add_user_to_room(self, room_id: UUID, user: User, role: RoomRole = RoomRole.PLAYER) -> RoomUsers:
        """Добавить пользователя в комнату"""
        room = await self.get_room(room_id)

        if await self.is_in_room(room_id, user.id):
            raise RoomAccessError("Пользователь уже в комнате")

        room_user = RoomUsers(
            room_id=room_id,
            user_id=user.id,
            room_role=role
        )
        self.db.add(room_user)
        return room_user

    async def remove_user_from_room(self, room_id: UUID, user_id: UUID, acting_user: User):
        """Удалить пользователя из комнаты"""
        room = await self.get_room(room_id)

        if not await self.is_in_room(room_id, user_id):
            raise RoomAccessError("Пользователь не найден в комнате")

        if not (acting_user.id == user_id or
                room.owner_id == acting_user.id or
                await self.is_dm(room_id, acting_user.id)):
            raise RoomPermissionError("Нет прав на удаление пользователя из комнаты")

        result = await self.db.execute(
            select(RoomUsers).filter_by(
                room_id=room_id,
                user_id=user_id
            )
        )
        room_user = result.scalar_one()

        await self.db.delete(room_user)

    async def change_user_role(self, room_id: UUID, user_id: UUID, new_role: RoomRole, acting_user: User) -> RoomUsers:
        """Изменить роль пользователя"""
        room = await self.get_room(room_id)

        if not await self.is_dm(room_id, acting_user.id):
            raise RoomPermissionError("Только DM может менять роли")

        if not await self.is_in_room(room_id, user_id):
            raise RoomAccessError("Пользователь не найден в комнате")

        result = await self.db.execute(
            select(RoomUsers).filter_by(
                room_id=room_id,
                user_id=user_id
            )
        )
        room_user = result.scalar_one()

        if user_id == acting_user.id:
            raise RoomPermissionError("DM не может изменить свою роль")

        room_user.room_role = new_role
        return room_user

    async def get_user_role(self, room_id: UUID, user_id: UUID) -> Optional[str]:
        """Возвращает роль пользователя в комнате"""
        result = await self.db.execute(
            select(RoomUsers.room_role).filter_by(room_id=room_id, user_id=user_id)
        )
        return result.scalar_one()

    async def get_room_users(self, room_id: UUID, role: Optional[RoomRole] = None) -> List[RoomUserListItem]:
        """Получить всех участников комнаты, опционально фильтруя по роли"""
        query = select(RoomUsers).options(
            joinedload(RoomUsers.user)
        ).filter_by(room_id=room_id)

        if role is not None:
            query = query.filter_by(room_role=role)

        result = await self.db.execute(query)
        room_users = result.scalars().all()

        return [
            RoomUserListItem(
                user_id=ru.user.id,
                username=ru.user.username,
                room_role=ru.room_role,
                joined_at=ru.joined_at
            )
            for ru in room_users
        ]

    # Работа с картами
    async def add_map_to_room(
            self,
            room_id: UUID,
            user_id: UUID,
            name: str,
            file: Optional[UploadFile] = None,
            template_id: Optional[UUID] = None,
            s3_client: Optional[S3Client] = None
    ) -> RoomMap:
        """Универсальный метод добавления карты"""

        if not template_id and not file:
            raise ValueError("Требуется template_id или файл изображения")
        if template_id and file:
            raise ValueError("Нельзя указать и template_id, и файл")

        if not await self.is_dm(room_id, user_id):
            raise PermissionError("Только DM может добавлять карты")

        if template_id is not None:
            template = await self.db.get(MapTemplate, template_id)
            if not template:
                raise ValueError(f"Шаблон карты с id {template_id} не найден")

        image_id = None
        if file:
            if not s3_client:
                raise ValueError("S3 client required for file upload")
            image_id = await self._upload_image_file(
                file=file,
                user_id=user_id,
                caption=name,
                s3_client=s3_client
            )

        room_map = RoomMap(
            room_id=room_id,
            template_id=template_id,
            image_id=image_id,
            name_in_room=name
        )
        self.db.add(room_map)
        await self.db.flush()

        result = await self.db.execute(
            select(RoomMap)
            .filter_by(id=room_map.id)
            .options(
                selectinload(RoomMap.template).selectinload(MapTemplate.image),
                selectinload(RoomMap.image).selectinload(Image.thumbnail)
            )
        )

        return result.scalar_one()

    async def get_room_maps(self, room_id: UUID) -> List[RoomMapListItem]:
        result = await self.db.execute(
            select(RoomMap)
            .filter_by(room_id=room_id)
            .options(
                selectinload(RoomMap.image),
                selectinload(RoomMap.template).selectinload(MapTemplate.image)
            )
        )
        room_maps = list(result.scalars().all())

        items = []
        for room_map in room_maps:
            item = RoomMapListItem.model_validate(room_map)

            if self.media_service:
                if room_map.image:
                    item.image_url = await self.media_service.get_image_url(room_map.image)
                elif room_map.template and room_map.template.image:
                    item.image_url = await self.media_service.get_image_url(room_map.template.image)

            if room_map.template:
                item.template_name = room_map.template.name
                if room_map.template.image:
                    item.template_image_id = room_map.template.image.id

            items.append(item)

        return items

    async def remove_map_from_room(self, map_id: int):
        """Удалить карту из комнаты"""
        room_map = await self.db.get(RoomMap, map_id)
        if not room_map:
            raise HTTPException(404, "Комната не найдена")

        await self.db.delete(room_map)

    # Работа с токенами
    async def add_token_to_room(self, room_id: UUID, token_data: RoomTokenCreate, user: User) -> RoomToken:
        """Добавить токен в комнату"""
        room = await self.get_room(room_id)
        if not self.is_dm(room_id, user.id):
            raise RoomPermissionError("только DM может загружать токены")

        token_dict = token_data.model_dump()

        if token_dict.get('current_hp') is None and token_dict.get('creature_template_id'):
            template = await self.db.get(CreatureTemplate, token_dict['creature_template_id'])
            if template and template.max_hp:
                token_dict['current_hp'] = template.max_hp

        token = RoomToken(
            room_id=room_id,
            **token_dict
        )
        self.db.add(token)
        return token

    async def create_prop_token(
            self,
            room_id: UUID,
            image_id: int,
            name: str,
            position_x: float = 0,
            position_y: float = 0,
            width: int = None,
            height: int = None,
            user: User = None
    ) -> RoomToken:
        """Создать prop-токен (просто изображение без статов)"""
        room = await self.get_room(room_id)
        if not await self.is_dm(room_id, user.id):
            raise RoomPermissionError("Только DM может добавлять объекты на поле")

        token = RoomToken(
            room_id=room_id,
            image_id=image_id,
            name_in_room=name,
            position_x=position_x,
            position_y=position_y,
            width=width,
            height=height,
            token_type=TokenType.PROP
        )
        self.db.add(token)
        await self.db.flush()
        return token

    async def delete_token(self, token_id: int) -> None:
        """Удалить токен из комнаты"""
        token = await self.db.get(RoomToken, token_id)

        if not isinstance(token, RoomToken):
            raise ValueError(f"{token_id} не найден или не является токеном в комнате")

        await self.db.delete(token)

    async def get_list_tokens(
            self,
            room_id: UUID,
            controlled_by: Optional[UUID] = None
    ) -> List[RoomToken]:
        """Получить список токенов комнаты"""
        query = select(RoomToken).filter_by(room_id=room_id)

        if controlled_by is not None:
            query = query.filter_by(controlled_by=controlled_by)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def update_token_position(self, token_id: int, x: float, y: float,
                                   rotation: Optional[float] = None, user: User = None):
        """Обновить позицию токена"""
        token = await self.db.get(RoomToken, token_id)

        if not await self.can_control_token(token_id, token.room_id, user.id):
            raise RoomPermissionError("Нет прав на управление этим токеном")

        if token:
            token.position_x = x
            token.position_y = y
            if rotation is not None:
                token.rotation = rotation

    async def update_token_hp(self, token_id: int, hp_delta: int) -> int:
        """Обновить HP токена, возвращает новое значение HP"""
        token = await self.db.get(RoomToken, token_id)
        token.current_hp += hp_delta
        if token.current_hp < 0:
            token.current_hp = 0

        return token.current_hp

    async def update_token_conditions(
            self,
            token_id: int,
            add: Optional[List[str]] = None,
            remove: Optional[List[str]] = None,
            set_conditions: Optional[List[str]] = None,
            clear: bool = False
    ) -> RoomToken:
        """Обновить состояния токена"""
        token = await self.db.get(RoomToken, token_id)
        if not isinstance(token, RoomToken):
            raise ValueError(f"{token_id} не найден или не является токеном в комнате")

        if set_conditions is not None:
            token.conditions = set_conditions
        elif clear:
            token.conditions = []
        else:
            current = set(token.conditions or [])

            if add:
                current.update(add)

            if remove:
                current.difference_update(remove)

            token.conditions = list(current)

        return token

    async def set_token_visibility(self, token_id: int, is_visible: bool) -> RoomToken:
        """Установить видимость токена"""
        token = await self.db.get(RoomToken, token_id)
        if not isinstance(token, RoomToken):
            raise ValueError(f"{token_id} не найден или не является токеном в комнате")

        token.is_visible = is_visible
        return token

    async def can_control_token(self, token_id: int, room_id: UUID, user_id: UUID) -> bool:
        """Проверка, может ли пользователь управлять токеном"""
        token = await self.db.get(RoomToken, token_id)
        if not token or token.room_id != room_id:
            return False

        if await self.is_dm(room_id, user_id):
            return True

        return token.controlled_by == user_id

    # Управление правами
    async def is_dm(self, room_id: UUID, user_id: UUID) -> bool:
        """Проверить, является ли пользователь DM в комнате"""
        result = await self.db.execute(
            select(RoomUsers).filter_by(
                room_id=room_id,
                user_id=user_id,
                room_role=RoomRole.DM
            )
        )
        return result.scalar_one_or_none() is not None

    async def is_in_room(self, room_id: UUID, user_id: UUID) -> bool:
        """Проверить, находится ли пользователь в комнате"""
        result = await self.db.execute(
            select(RoomUsers).filter_by(
                room_id=room_id,
                user_id=user_id
            )
        )
        return result.scalar_one_or_none() is not None

    # Управление настройками комнаты
    async def get_room_settings(self, room_id: UUID) -> Optional[RoomSettings]:
        """Получить настройки комнаты"""
        result = await self.db.execute(
            select(RoomSettings).filter_by(room_id=room_id)
        )
        return result.scalar_one_or_none()

    async def create_room_settings(
            self,
            room_id: UUID,
            settings_data: RoomSettingsCreate
    ) -> RoomSettings:
        """Создать настройки комнаты"""
        settings = RoomSettings(
            room_id=room_id,
            **settings_data.model_dump()
        )
        self.db.add(settings)
        await self.db.flush()
        await self.db.refresh(settings)
        return settings

    async def update_room_settings(
            self,
            room_id: UUID,
            settings_data: RoomSettingsUpdate
    ) -> RoomSettings:
        """Обновить настройки комнаты"""
        settings = await self.get_room_settings(room_id)

        if not settings:
            settings = await self.create_room_settings(room_id, RoomSettingsCreate())

        update_data = settings_data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(settings, key, value)

        await self.db.flush()
        await self.db.refresh(settings)
        return settings

    # Управление страницами комнаты
    async def get_room_page(self, page_id: int) -> Optional[RoomPage]:
        """Получить страницу по ID"""
        result = await self.db.execute(
            select(RoomPage)
            .where(RoomPage.id == page_id)
            .options(selectinload(RoomPage.background_image))
        )
        return result.scalar_one_or_none()

    async def get_room_pages(self, room_id: UUID) -> List[RoomPage]:
        """Получить все страницы комнаты"""
        result = await self.db.execute(
            select(RoomPage)
            .filter_by(room_id=room_id)
            .order_by(RoomPage.order)
            .options(selectinload(RoomPage.background_image))
        )
        return list(result.scalars().all())

    async def create_room_page(
            self,
            room_id: UUID,
            page_data: RoomPageCreate
    ) -> RoomPage:
        """Создать новую страницу"""
        if page_data.map_id is not None:
            room_map = await self.db.get(RoomMap, page_data.map_id)
            if not room_map or room_map.room_id != room_id:
                raise HTTPException(400, "Карта не найдена или не принадлежит этой комнате")

        page = RoomPage(
            room_id=room_id,
            **page_data.model_dump()
        )
        self.db.add(page)
        await self.db.flush()

        result = await self.db.execute(
            select(RoomPage)
            .where(RoomPage.id == page.id)
            .options(selectinload(RoomPage.background_image))
        )
        return result.scalar_one()

    async def update_room_page(
            self,
            page_id: int,
            page_data: RoomPageUpdate
    ) -> RoomPage:
        """Обновить страницу"""
        page = await self.get_room_page(page_id)
        if not page:
            raise HTTPException(404, "Страница не найдена")

        if page_data.map_id is not None:
            room_map = await self.db.get(RoomMap, page_data.map_id)
            if not room_map or room_map.room_id != page.room_id:
                raise HTTPException(400, "Карта не найдена или не принадлежит этой комнате")

        update_data = page_data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(page, key, value)

        await self.db.flush()
        await self.db.refresh(page)
        return page

    async def delete_room_page(self, page_id: int):
        """Удалить страницу"""
        page = await self.get_room_page(page_id)
        if not page:
            raise HTTPException(404, "Страница не найдена")

        await self.db.delete(page)

    async def set_active_page(self, room_id: UUID, page_id: int) -> Room:
        """Установить активную страницу комнаты"""
        room = await self.get_room(room_id)
        if not room:
            raise HTTPException(404, "Комната не найдена")

        # Проверка, что страница принадлежит комнате
        page = await self.get_room_page(page_id)
        if not page or page.room_id != room_id:
            raise HTTPException(400, "Страница не принадлежит этой комнате")

        room.active_page_id = page_id
        await self.db.flush()
        await self.db.refresh(room)
        return room

    async def set_page_background_image(
            self,
            page_id: int,
            image_id: int,
    ) -> RoomPage:
        """Установить фоновое изображение для страницы из существующего изображения"""
        page = await self.get_room_page(page_id)
        if not page:
            raise HTTPException(404, "Страница не найдена")

        page.background_image_id = image_id
        await self.db.flush()

        result = await self.db.execute(
            select(RoomPage)
            .where(RoomPage.id == page_id)
            .options(selectinload(RoomPage.background_image))
        )
        return result.scalar_one()

    async def remove_page_background_image(self, page_id: int):
        """Удалить фоновое изображение страницы"""
        page = await self.get_room_page(page_id)
        if not page:
            raise HTTPException(404, "Страница не найдена")

        page.background_image_id = None
        await self.db.flush()

    # Работа с сообщениями чата
    async def save_chat_message(
            self,
            room_id: UUID,
            user_id: UUID,
            message_data: ChatMessageCreate
    ) -> ChatMessage:
        """Сохранить сообщение чата в БД"""
        chat_message = ChatMessage(
            room_id=room_id,
            user_id=user_id,
            content=message_data.content,
            message_type=message_data.message_type
        )
        self.db.add(chat_message)
        await self.db.flush()
        await self.db.refresh(chat_message)
        return chat_message

    async def get_chat_messages(
            self,
            room_id: UUID,
            limit: int = 100,
            offset: int = 0
    ) -> ChatMessageListResponse:
        """Получить историю сообщений чата для комнаты"""
        # Подсчет общего количества
        count_query = select(func.count(ChatMessage.id)).filter_by(room_id=room_id)
        count_result = await self.db.execute(count_query)
        total = count_result.scalar()

        # Получение сообщений
        query = (
            select(ChatMessage, User.username)
            .outerjoin(User, ChatMessage.user_id == User.id)
            .filter(ChatMessage.room_id == room_id)
            .order_by(ChatMessage.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await self.db.execute(query)
        rows = result.all()

        messages = [
            ChatMessageResponse(
                id=msg.id,
                room_id=msg.room_id,
                user_id=msg.user_id,
                username=username,
                content=msg.content,
                message_type=msg.message_type,
                created_at=msg.created_at
            )
            for msg, username in rows
        ]

        # Разворачиваем чтобы сообщения шли по возрастанию времени
        messages.reverse()

        return ChatMessageListResponse(
            messages=messages,
            total=total
        )

    async def bulk_save_chat_messages(
            self,
            room_id: UUID,
            messages: list[dict]
    ) -> int:
        """Массовое сохранение сообщений чата (для автосохранения)"""
        if not messages:
            return 0

        chat_messages = [
            ChatMessage(
                room_id=room_id,
                user_id=msg.get('user_id'),
                content=msg['content'],
                message_type=msg.get('message_type', 'text'),
                created_at=msg.get('created_at')
            )
            for msg in messages
        ]
        self.db.add_all(chat_messages)
        await self.db.flush()
        return len(chat_messages)
