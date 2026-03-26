from uuid import UUID
from src.rooms.livekit.config import livekit_config
from src.rooms.enum import RoomRole


def generate_livekit_token(
    room_id: UUID,
    user_id: UUID,
    username: str,
    role: RoomRole
) -> str:
    """
    Сгенерировать токен LiveKit для пользователя в комнате
    
    :param room_id: ID игровой комнаты
    :param user_id: ID пользователя
    :param username: Имя пользователя (отображается в LiveKit)
    :param role: Роль пользователя в комнате (DM/player/spectator)
    :return: JWT токен для подключения
    """
    
    # Настройка прав в зависимости от роли
    permissions = _get_permissions_for_role(role)
    
    # participant_name = user_id (уникальный идентификатор)
    participant_name = str(user_id)
    
    # metadata можно передать роль для frontend
    metadata = {
        "user_id": str(user_id),
        "username": username,
        "room_role": role.value
    }
    
    token = livekit_config.create_token(
        room_name=str(room_id),
        participant_name=participant_name,
        **permissions
    )
    
    return token


def _get_permissions_for_role(role: RoomRole) -> dict:
    """
    Определить права доступа в зависимости от роли
    
    DM — полные права
    Player — может публиковать видео/аудио/data
    Spectator — только просмотр (subscribe)
    """
    if role == RoomRole.DM:
        return {
            "can_publish": True,
            "can_subscribe": True,
            "can_publish_data": True,
            "can_update_metadata": True,
        }
    
    elif role == RoomRole.PLAYER:
        return {
            "can_publish": True,
            "can_subscribe": True,
            "can_publish_data": True,
            "can_update_metadata": False,
        }
    
    elif role == RoomRole.SPECTATOR:
        return {
            "can_publish": False,
            "can_subscribe": True,
            "can_publish_data": False,
            "can_update_metadata": False,
        }
    