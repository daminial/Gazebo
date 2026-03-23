from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from src.bestiary.schemas import RoomTokenResponse, RoomTokenCreate
from src.core.database import get_db
from src.auth.dependencies import get_current_user
from src.auth.models import User
from src.map.schemas import RoomMapCreate
from src.rooms.enum import RoomRole
from src.rooms.service import RoomService
from src.rooms.schemas import (RoomResponse, RoomCreate, RoomUpdate, RoomUserListItem,
                               RoomUserResponse, RoomUserUpdate, RoomMapBasicInfo, RoomTokenBasicInfo,
                               TokenPositionUpdate, TokenHPUpdate, TokenConditionsUpdate, TokenVisibilityUpdate,
                               RoomMapInRoom)

router = APIRouter(prefix="/rooms", tags=["rooms"], redirect_slashes=False)


@router.post("", response_model=RoomResponse)
async def create_room(
        room_data: RoomCreate,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Создать новую комнату"""
    service = RoomService(db)
    room = await service.create_room(room_data.name, current_user)
    return room


@router.get("/{room_id}", response_model=RoomResponse)
async def get_room(
        room_id: UUID,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Получить информацию о комнате"""
    service = RoomService(db)
    room = await service.get_room(room_id)

    if not await service.is_in_room(room_id, current_user.id):
        raise HTTPException(403, "Вы не в этой комнате")

    return room


@router.put("/{room_id}", response_model=RoomResponse)
async def update_room(
        room_id: UUID,
        room_update: RoomUpdate,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Обновить комнату"""
    service = RoomService(db)

    update_data = room_update.model_dump(exclude_unset=True)
    room = await service.update_room(room_id, update_data, current_user)

    return room

@router.delete("/{room_id}")
async def delete_room(
        room_id: UUID,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Удалить комнату"""
    service = RoomService(db)
    await service.delete_room(room_id, current_user)
    return {"message": "Комната удалена"}


# Управление участниками
@router.post("/{room_id}/users/{user_id}")
async def add_user_to_room(
        room_id: UUID,
        user_id: UUID,
        role: RoomRole = RoomRole.PLAYER,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Добавить пользователя в комнату (только DM)"""
    service = RoomService(db)

    if not await service.is_dm(room_id, current_user.id):
        raise HTTPException(403, "Только DM может добавлять пользователей")

    user_to_add = await db.get(User, user_id)
    if not isinstance(user_to_add, User):
        raise HTTPException(404, "Пользователь не найден")

    room_user = await service.add_user_to_room(room_id, user_to_add, role)
    return room_user


@router.get("/{room_id}/users", response_model=List[RoomUserListItem])
async def get_room_users(
        room_id: UUID,
        role: Optional[RoomRole] = None,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Получить всех участников комнаты, опционально фильтруя по роли"""
    service = RoomService(db)

    if not await service.is_in_room(room_id, current_user.id):
        raise HTTPException(403, "Вы не в этой комнате")

    users = await service.get_room_users(room_id, role)
    return users


@router.patch("/{room_id}/users/{user_id}/role", response_model=RoomUserResponse)
async def change_user_role(
        room_id: UUID,
        user_id: UUID,
        role_update: RoomUserUpdate,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Изменить роль пользователя (только DM)"""
    service = RoomService(db)

    room_user = await service.change_user_role(room_id, user_id, role_update.room_role, current_user)

    return room_user

@router.delete("/{room_id}/users/{user_id}")
async def remove_user_from_room(
        room_id: UUID,
        user_id: UUID,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Удалить пользователя из комнаты"""
    service = RoomService(db)

    if current_user.id != user_id:
        if not await service.is_dm(room_id, current_user.id):
            raise HTTPException(403, "Только DM может удалять других пользователей")

    await service.remove_user_from_room(room_id, user_id, acting_user=current_user)
    return {"message": "Пользователь удален из комнаты"}


# Управление картами
@router.post("/{room_id}/maps", response_model=RoomMapInRoom)
async def add_map_to_room(
        room_id: UUID,
        map_data: RoomMapCreate,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Добавить карту в комнату"""
    service = RoomService(db)

    if not await service.is_dm(room_id, current_user.id):
        raise HTTPException(403, "Только DM может добавлять карты")

    room_map = await service.add_map_to_room(
        room_id=room_id,
        template_id=map_data.template_id,
        name=map_data.name_in_room
    )
    return room_map


@router.get("/{room_id}/maps", response_model=List[RoomMapBasicInfo])
async def get_room_maps(
        room_id: UUID,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Получить все карты в комнате"""
    service = RoomService(db)

    if not await service.is_in_room(room_id, current_user.id):
        raise HTTPException(403, "Вы не в этой комнате")

    maps = await service.get_room_maps(room_id)
    return maps


# @router.put("/{room_id}/maps/{map_id}", response_model=RoomMapResponse)
# async def update_room_map(
#         room_id: UUID,
#         map_id: int,
#         map_update: RoomMapUpdate,
#         db: AsyncSession = Depends(get_db),
#         current_user: User = Depends(get_current_user)
# ):
#     """Обновить карту в комнате (только DM)"""
#     service = RoomService(db)
#
#     if not service.is_dm(room_id, current_user.id):
#         raise HTTPException(403, "Только DM может изменять карты")
#
#     room_map = service.update_room_map(map_id, map_update.dict(exclude_unset=True))
#     if not room_map:
#         raise HTTPException(404, "Карта не найдена")
#
#     return room_map


@router.delete("/{room_id}/maps/{map_id}")
async def remove_map_from_room(
        room_id: UUID,
        map_id: int,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Удалить карту из комнаты (только DM)"""
    service = RoomService(db)

    if not await service.is_dm(room_id, current_user.id):
        raise HTTPException(403, "Только DM может удалять карты")

    await service.remove_map_from_room(map_id)
    return {"message": "Карта удалена из комнаты"}


# Управление токенами
@router.post("/{room_id}/tokens", response_model=RoomTokenResponse)
async def create_token(
        room_id: UUID,
        token_data: RoomTokenCreate,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Создать токен в комнате"""
    service = RoomService(db)

    if not await service.is_in_room(room_id, current_user.id):
        raise HTTPException(403, "Вы не в этой комнате")

    token = await service.add_token_to_room(room_id, token_data, current_user)
    return token

@router.get("/{room_id}/tokens", response_model=List[RoomTokenBasicInfo])
async def get_room_tokens(
        room_id: UUID,
        controlled_by: Optional[UUID] = None,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Получить все токены в комнате"""
    service = RoomService(db)

    if not await service.is_in_room(room_id, current_user.id):
        raise HTTPException(403, "Вы не в этой комнате")

    tokens = await service.get_list_tokens(room_id, controlled_by)
    return tokens


@router.patch("/{room_id}/tokens/{token_id}/position")
async def update_token_position(
        room_id: UUID,
        token_id: int,
        position: TokenPositionUpdate,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Обновить позицию токена"""
    service = RoomService(db)

    await service.update_token_position(
        token_id,
        position.position_x,
        position.position_y,
        position.rotation,
        current_user
    )
    return {"message": "Позиция обновлена"}


@router.patch("/{room_id}/tokens/{token_id}/hp")
async def update_token_hp(
        room_id: UUID,
        token_id: int,
        hp_update: TokenHPUpdate,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Обновить HP токена"""
    service = RoomService(db)

    if not await service.can_control_token(token_id, room_id, current_user.id):
        raise HTTPException(403, "Нет прав на управление этим токеном")

    updated_hp = await service.update_token_hp(token_id, hp_update.hp_delta)
    return {
        "message": "HP обновлено",
        "new_hp": updated_hp,
        "delta_applied": hp_update.hp_delta
    }


@router.patch("/{room_id}/tokens/{token_id}/conditions")
async def update_token_conditions(
        room_id: UUID,
        token_id: int,
        conditions_update: TokenConditionsUpdate,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Обновить состояния токена"""
    service = RoomService(db)

    if not await service.is_dm(room_id, current_user.id):
        raise HTTPException(403, "Только DM может менять состояния")

    await service.update_token_conditions(
        token_id=token_id,
        add=conditions_update.add,
        remove=conditions_update.remove,
        set_conditions=conditions_update.set,
        clear=conditions_update.clear
    )

@router.patch("/{room_id}/tokens/{token_id}/visibility")
async def toggle_token_visibility(
        room_id: UUID,
        token_id: int,
        visibility: TokenVisibilityUpdate,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Изменить видимость токена"""
    service = RoomService(db)

    if not await service.is_dm(room_id, current_user.id):
        raise HTTPException(403, "Только DM может менять видимость")

    await service.set_token_visibility(token_id, visibility.is_visible)
    return {"message": "Видимость изменена"}


@router.delete("/{room_id}/tokens/{token_id}")
async def delete_token(
        room_id: UUID,
        token_id: int,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Удалить токен"""
    service = RoomService(db)

    if not await service.is_dm(room_id, current_user.id):
        raise HTTPException(403, "Только DM может удалять токены")

    await service.delete_token(token_id)
    return {"message": "Токен удален"}
