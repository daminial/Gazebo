
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4, UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from src.rooms.models import Room, RoomUsers, RoomSettings, RoomPage, RoomRole
from src.rooms.exceptions import RoomNotFoundError, RoomPermissionError, RoomAccessError
from src.rooms.schemas import RoomCreate, RoomUpdate, RoomPageCreate
from src.auth.models import User


class TestRoomPermissionError:
    """Проверка RoomPermissionError: пользователь без роли DM не может изменять настройки комнаты"""

    def test_room_permission_error_creation(self):
        """Тест создания исключения RoomPermissionError"""
        exception = RoomPermissionError()

        assert exception.status_code == 403
        assert "прав" in exception.detail.lower()

    def test_room_permission_error_custom_message(self):
        """Тест исключения с кастомным сообщением"""
        custom_message = "Только DM может редактировать комнату"
        exception = RoomPermissionError(custom_message)

        assert exception.status_code == 403
        assert exception.detail == custom_message

    def test_room_permission_error_inheritance(self):
        """Тест что исключение наследуется от HTTPException"""
        from fastapi import HTTPException

        exception = RoomPermissionError()
        assert isinstance(exception, HTTPException)


class TestGetNonexistentRoom:
    """Проверка RoomNotFoundError при запросе несуществующей комнаты"""

    def test_room_not_found_error_creation(self):
        """Тест создания исключения RoomNotFoundError"""
        exception = RoomNotFoundError()

        assert exception.status_code == 404
        assert "не найдена" in exception.detail.lower()

    def test_room_not_found_error_custom_message(self):
        """Тест исключения с кастомным сообщением"""
        custom_message = "Комната с таким ID не существует"
        exception = RoomNotFoundError(custom_message)

        assert exception.status_code == 404
        assert exception.detail == custom_message


class TestRoomSettingsDefaults:
    """Проверка значений по умолчанию для настроек комнаты"""

    def test_room_settings_default_values(self):
        """Тест значений по умолчанию RoomSettingsCreate"""
        from src.rooms.schemas import RoomSettingsCreate

        settings = RoomSettingsCreate()

        assert settings.is_public is False
        assert settings.grid_size == 50
        assert settings.grid_visible is True
        assert settings.players_can_draw is False
        assert settings.music_volume == 70
        assert settings.require_password is False

    def test_room_settings_grid_size_validation(self):
        """Тест валидации размера сетки"""
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            from src.rooms.schemas import RoomSettingsCreate
            RoomSettingsCreate(grid_size=5)

        with pytest.raises(ValidationError):
            RoomSettingsCreate(grid_size=250)

    def test_room_settings_music_volume_validation(self):
        """Тест валидации громкости музыки"""
        from pydantic import ValidationError
        from src.rooms.schemas import RoomSettingsCreate

        with pytest.raises(ValidationError):
            RoomSettingsCreate(music_volume=-10)

        with pytest.raises(ValidationError):
            RoomSettingsCreate(music_volume=110)