from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import Optional, List
from fastapi import HTTPException
from sqlalchemy.orm import joinedload

from src.bestiary.schemas import RoomTokenCreate
from src.rooms.exceptions import RoomNotFoundError, RoomPermissionError, RoomAccessError
from src.rooms.models import Room, RoomUsers, RoomRole
from src.auth.models import User
from src.map.models import RoomMap
from src.bestiary.models import RoomToken, CreatureTemplate
from src.rooms.schemas import RoomUserListItem


class RoomService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_room(self, name: str, user: User) -> Room:
        """Создать новую комнату"""
        room = Room(
            name=name,
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
        await self.db.commit()
        await self.db.refresh(room)

        return room

    async def get_room(self, room_id: UUID) -> Room:
        """Получить комнату по ID"""
        room = await self.db.get(Room, room_id)
        if not isinstance(room, Room):
            raise RoomNotFoundError()
        return room

    async def get_user_rooms(self, user: User) -> List[Room]:
        """Получить все комнаты пользователя"""
        return user.room_associations.all()

    async def update_room(self, room_id: UUID, data: dict, user: User) -> Room:
        """Обновить комнату"""
        room = await self.get_room(room_id)

        if room.owner_id != user.id and not await self.is_dm(room_id, user.id):
            raise RoomPermissionError("Только DM может редактировать комнату")

        for key, value in data.items():
            setattr(room, key, value)

        await self.db.commit()
        await self.db.refresh(room)
        return room

    async def delete_room(self, room_id: UUID, user: User):
        """Удалить комнату"""
        room = await self.get_room(room_id)

        if room.owner_id != user.id:
            raise RoomPermissionError("Только владелец может удалить комнату")

        await self.db.delete(room)
        await self.db.commit()

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
        await self.db.commit()
        await self.db.refresh(room_user)
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
        await self.db.commit()

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
        await self.db.commit()
        await self.db.refresh(room_user)
        return room_user

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
    async def add_map_to_room(self, room_id: UUID, template_id: int, name: str) -> RoomMap:
        """Добавить карту в комнату из шаблона"""
        room_map = RoomMap(
            room_id=room_id,
            template_id=template_id,
            name_in_room=name
        )
        self.db.add(room_map)
        await self.db.commit()
        await self.db.refresh(room_map, attribute_names=["template"])

        return room_map

    async def get_room_maps(self, room_id: UUID) -> List[RoomMap]:
        """Получить все карты комнаты"""
        result = await self.db.execute(
            select(RoomMap).filter_by(room_id=room_id)
        )
        return list(result.scalars().all())

    async def remove_map_from_room(self, map_id: int):
        """Удалить карту из комнаты"""
        room_map = await self.db.get(RoomMap, map_id)
        if not room_map:
            raise HTTPException(404, "Комната не найдена")

        await self.db.delete(room_map)
        await self.db.commit()

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
        await self.db.commit()
        await self.db.refresh(token)
        return token

    async def delete_token(self, token_id: int) -> None:
        """Удалить токен из комнаты"""
        token = await self.db.get(RoomToken, token_id)

        if not isinstance(token, RoomToken):
            raise ValueError(f"{token_id} не найден или не является токеном в комнате")

        await self.db.delete(token)
        await self.db.commit()

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

        if not token:
            raise ValueError(f"Токен {token_id} не найден")

        if not await self.can_control_token(token_id, token.room_id, user.id):
            raise RoomPermissionError("Нет прав на управление этим токеном")

        if token:
            token.position_x = x
            token.position_y = y
            if rotation is not None:
                token.rotation = rotation
            await self.db.commit()

    async def update_token_hp(self, token_id: int, hp_delta: int) -> int:
        """Обновить HP токена, возвращает новое значение HP"""
        token = await self.db.get(RoomToken, token_id)
        token.current_hp += hp_delta
        if token.current_hp < 0:
            token.current_hp = 0

        await self.db.commit()
        await self.db.refresh(token)

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

        await self.db.commit()
        await self.db.refresh(token)
        return token

    async def set_token_visibility(self, token_id: int, is_visible: bool) -> RoomToken:
        """Установить видимость токена"""
        token = await self.db.get(RoomToken, token_id)
        if not isinstance(token, RoomToken):
            raise ValueError(f"{token_id} не найден или не является токеном в комнате")

        token.is_visible = is_visible
        await self.db.commit()
        await self.db.refresh(token)
        return token

    async def can_control_token(self, token_id: int, room_id: UUID, user_id: UUID) -> bool:
        """Проверка, может ли пользователь управлять токеном"""
        token = await self.db.get(RoomToken, token_id)
        if not token or token.room_id != room_id:
            return False

        if self.is_dm(user_id, room_id):
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
