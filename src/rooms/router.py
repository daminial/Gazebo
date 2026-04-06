from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, Form, File
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from src.bestiary.schemas import RoomTokenResponse, RoomTokenCreate
from src.core.config import settings
from src.core.database import get_db
from src.auth.dependencies import get_current_user
from src.auth.models import User
from src.core.storage.dependencies import get_s3_client
from src.core.storage.s3Client import S3Client
from src.core.storage.service import MediaService
from src.map.schemas import RoomMapResponse, RoomMapListItem
from src.rooms.enum import RoomRole
from src.rooms.livekit import generate_livekit_token
from src.rooms.service import RoomService
from src.rooms.schemas import (RoomResponse, RoomUserListItem,
                               RoomUserResponse, RoomUserUpdate, RoomTokenBasicInfo,
                               TokenPositionUpdate, TokenHPUpdate, TokenConditionsUpdate, TokenVisibilityUpdate,
                               LiveKitTokenResponse, RoomSettingsResponse, RoomSettingsUpdate,
                               RoomPageResponse, RoomPageCreate, RoomPageUpdate, RoomPageListItem, RoomListItem)
from src.rooms.enum import RoomStatus

router = APIRouter(prefix="/rooms", tags=["rooms"], redirect_slashes=False)


@router.post("", response_model=RoomResponse)
async def create_room(
        name: str = Form(...),
        image: Optional[UploadFile] = File(None),
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user),
        s3_client: S3Client = Depends(get_s3_client)
):
    """Создать новую комнату"""
    service = RoomService(db)
    
    image_id = None
    if image:
        image_id = await service._upload_image_file(
            file=image,
            user_id=current_user.id,
            caption=name,
            s3_client=s3_client
        )
    
    room = await service.create_room(
        name=name,
        image_id=image_id,
        user=current_user
    )
    return room


@router.get("/my", response_model=List[RoomListItem])
async def get_my_rooms(
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Возвращает список всех комнат, в которых участвует пользователь"""
    service = RoomService(db)
    rooms = await service.get_user_rooms(current_user)
    return rooms


@router.get("/{room_id}", response_model=RoomResponse)
async def get_room(
        room_id: UUID,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Получить информацию о комнате"""
    service = RoomService(db)
    room = await service.get_room(room_id)

    if not room or not await service.is_in_room(room_id, current_user.id):
        raise HTTPException(403, "Вы не в этой комнате")

    return room


@router.put("/{room_id}", response_model=RoomResponse)
async def update_room(
        room_id: UUID,
        name: Optional[str] = Form(None),
        image: Optional[UploadFile] = File(None),
        status: Optional[RoomStatus] = Form(None),
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user),
        s3_client: S3Client = Depends(get_s3_client)
):
    """Обновить комнату"""
    service = RoomService(db)
    
    update_data = {}
    if name is not None:
        update_data['name'] = name
    if status is not None:
        update_data['status'] = status
    
    if image:
        image_id = await service._upload_image_file(
            file=image,
            user_id=current_user.id,
            caption=name or f"Room {room_id}",
            s3_client=s3_client
        )
        update_data['image_id'] = image_id
    
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


@router.post("/{room_id}/livekit-token", response_model=LiveKitTokenResponse)
async def get_livekit_token(
        room_id: UUID,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    service = RoomService(db)
    role = await service.get_user_role(room_id, current_user.id)

    if not role:
        raise HTTPException(403, "Вы не в этой комнате")

    token = generate_livekit_token(
        room_id=room_id,
        user_id=current_user.id,
        username=current_user.username,
        role=role
    )

    return LiveKitTokenResponse(
        token=token,
        url=settings.LIVEKIT_URL,
        room_id=room_id
    )

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
@router.post("/{room_id}/maps", response_model=RoomMapResponse, status_code=201)
async def add_map_to_room(
        room_id: UUID,
        file: Optional[UploadFile] = File(None),
        template_id: Optional[int] = Form(None),
        name_in_room: str = Form(...),
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user),
        s3_client: S3Client = Depends(get_s3_client)
):
    """Добавить карту в комнату (файл или template)"""

    room_service = RoomService(db)
    media_service = MediaService(s3_client, db)

    try:
        room_map = await room_service.add_map_to_room(
            room_id=room_id,
            user_id=current_user.id,
            name=name_in_room,
            file=file,
            template_id=template_id,
            s3_client=s3_client
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
    except PermissionError as e:
        raise HTTPException(403, str(e))

    response = RoomMapResponse.model_validate(room_map)
    if room_map.image:
        response.image_url = await media_service.get_image_url(room_map.image)
    elif room_map.template and room_map.template.image:
        response.image_url = await media_service.get_image_url(room_map.template.image)
        response.template_name = room_map.template.name
        response.template_image_id = room_map.template.image.id

    return response



@router.get("/{room_id}/maps", response_model=List[RoomMapListItem])
async def get_room_maps(
        room_id: UUID,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user),
        s3_client: S3Client = Depends(get_s3_client)
):
    """Получить все карты в комнате"""

    media_service = MediaService(s3_client, db)
    service = RoomService(db, media_service)

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


# Управление настройками комнаты
@router.get("/{room_id}/settings", response_model=RoomSettingsResponse)
async def get_room_settings(
        room_id: UUID,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Получить настройки комнаты"""
    service = RoomService(db)

    if not await service.is_in_room(room_id, current_user.id):
        raise HTTPException(403, "Вы не в этой комнате")

    room_settings = await service.get_room_settings(room_id)
    if not room_settings:
        raise HTTPException(404, "Настройки комнаты не найдены")

    return room_settings


@router.patch("/{room_id}/settings", response_model=RoomSettingsResponse)
async def update_room_settings(
        room_id: UUID,
        settings_data: RoomSettingsUpdate,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Обновить настройки комнаты (только DM)"""
    service = RoomService(db)

    if not await service.is_dm(room_id, current_user.id):
        raise HTTPException(403, "Только DM может изменять настройки комнаты")

    settings = await service.update_room_settings(room_id, settings_data)
    return settings


# Управление страницами комнаты
@router.post("/{room_id}/pages", response_model=RoomPageResponse, status_code=201)
async def create_room_page(
        room_id: UUID,
        page_data: RoomPageCreate,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user),
        s3_client: S3Client = Depends(get_s3_client)
):
    """Создать новую страницу в комнате (только DM)"""
    service = RoomService(db)
    media_service = MediaService(s3_client, db)

    if not await service.is_dm(room_id, current_user.id):
        raise HTTPException(403, "Только DM может создавать страницы")

    page = await service.create_room_page(room_id, page_data)

    response = RoomPageResponse.model_validate(page)
    if page.background_image:
        response.background_image_url = await media_service.get_image_url(page.background_image)
    return response


@router.get("/{room_id}/pages", response_model=List[RoomPageListItem])
async def get_room_pages(
        room_id: UUID,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user),
        s3_client: S3Client = Depends(get_s3_client)
):
    """Получить все страницы комнаты"""
    service = RoomService(db)
    media_service = MediaService(s3_client, db)

    if not await service.is_in_room(room_id, current_user.id):
        raise HTTPException(403, "Вы не в этой комнате")

    pages = await service.get_room_pages(room_id)
    result = []
    for page in pages:
        item = RoomPageListItem.model_validate(page)
        if page.background_image:
            item.background_image_url = await media_service.get_image_url(page.background_image)
        result.append(item)
    return result


@router.get("/{room_id}/pages/{page_id}", response_model=RoomPageResponse)
async def get_room_page(
        room_id: UUID,
        page_id: int,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user),
        s3_client: S3Client = Depends(get_s3_client)
):
    """Получить страницу по ID"""
    service = RoomService(db)
    media_service = MediaService(s3_client, db)

    if not await service.is_in_room(room_id, current_user.id):
        raise HTTPException(403, "Вы не в этой комнате")

    page = await service.get_room_page(page_id)
    if not page or page.room_id != room_id:
        raise HTTPException(404, "Страница не найдена")

    response = RoomPageResponse.model_validate(page)
    if page.background_image:
        response.background_image_url = await media_service.get_image_url(page.background_image)
    return response


@router.put("/{room_id}/pages/{page_id}", response_model=RoomPageResponse)
async def update_room_page(
        room_id: UUID,
        page_id: int,
        page_data: RoomPageUpdate,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user),
        s3_client: S3Client = Depends(get_s3_client)
):
    """Обновить страницу (только DM)"""
    service = RoomService(db)
    media_service = MediaService(s3_client, db)

    if not await service.is_dm(room_id, current_user.id):
        raise HTTPException(403, "Только DM может изменять страницы")

    page = await service.get_room_page(page_id)
    if not page or page.room_id != room_id:
        raise HTTPException(404, "Страница не найдена")

    page = await service.update_room_page(page_id, page_data)

    response = RoomPageResponse.model_validate(page)
    if page.background_image:
        response.background_image_url = await media_service.get_image_url(page.background_image)
    return response


@router.delete("/{room_id}/pages/{page_id}")
async def delete_room_page(
        room_id: UUID,
        page_id: int,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Удалить страницу (только DM)"""
    service = RoomService(db)

    if not await service.is_dm(room_id, current_user.id):
        raise HTTPException(403, "Только DM может удалять страницы")

    page = await service.get_room_page(page_id)
    if not page or page.room_id != room_id:
        raise HTTPException(404, "Страница не найдена")

    await service.delete_room_page(page_id)
    return {"message": "Страница удалена"}


@router.post("/{room_id}/pages/{page_id}/set-active")
async def set_active_page(
        room_id: UUID,
        page_id: int,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Установить активную страницу комнаты (только DM)"""
    service = RoomService(db)

    if not await service.is_dm(room_id, current_user.id):
        raise HTTPException(403, "Только DM может менять активную страницу")

    room = await service.set_active_page(room_id, page_id)
    return {"message": "Активная страница установлена", "page_id": page_id}


@router.post("/{room_id}/pages/{page_id}/set-background-image")
async def set_page_background_image(
        room_id: UUID,
        page_id: int,
        request_body: dict,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user),
        s3_client: S3Client = Depends(get_s3_client)
):
    """Установить фоновое изображение для страницы из существующего image_id (только DM)"""
    image_id = request_body.get("image_id")
    if not image_id:
        raise HTTPException(400, "Требуется image_id")

    service = RoomService(db)
    media_service = MediaService(s3_client, db)

    if not await service.is_dm(room_id, current_user.id):
        raise HTTPException(403, "Только DM может устанавливать фоновые изображения")

    page = await service.get_room_page(page_id)
    if not page or page.room_id != room_id:
        raise HTTPException(404, "Страница не найдена")

    page = await service.set_page_background_image(page_id=page_id, image_id=image_id)

    response = RoomPageResponse.model_validate(page)
    if page.background_image:
        response.background_image_url = await media_service.get_image_url(page.background_image)

    return response


@router.delete("/{room_id}/pages/{page_id}/background")
async def remove_page_background(
        room_id: UUID,
        page_id: int,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Удалить фоновое изображение страницы (только DM)"""
    service = RoomService(db)

    if not await service.is_dm(room_id, current_user.id):
        raise HTTPException(403, "Только DM может удалять фоновые изображения")

    page = await service.get_room_page(page_id)
    if not page or page.room_id != room_id:
        raise HTTPException(404, "Страница не найдена")

    await service.remove_page_background_image(page_id)
    return {"message": "Фоновое изображение удалено"}
