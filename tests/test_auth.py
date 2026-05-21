
import pytest
from unittest.mock import patch, MagicMock
from datetime import timedelta
from uuid import UUID

from src.auth.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    verify_token
)
from src.auth.exceptions import (
    EmailAlreadyExistsException,
    UsernameAlreadyExistsException,
    InvalidCredentialsException,
    UsernameValidationException
)
from src.auth.schemas import UserCreate, LoginRequest


class TestInvalidCredentialsException:
    """Проверка исключения InvalidCredentialsException при неверном email или пароле"""

    def test_invalid_credentials_exception(self):
        """Тест выбрасывания исключения InvalidCredentialsException"""
        exception = InvalidCredentialsException()

        assert exception.status_code == 401
        assert "неверн" in exception.detail.lower() or "логин" in exception.detail.lower()

    def test_invalid_credentials_exception_detail(self):
        """Тест сообщения исключения"""
        exception = InvalidCredentialsException()

        assert exception.detail == "Неверный логин или пароль"


class TestPasswordHashing:
    """Проверка что пароль корректно хэшируется и верифицируется через argon2"""

    def test_password_hashing_success(self):
        """Тест успешного хеширования и проверки пароля"""
        password = "TestPassword123"

        hashed = get_password_hash(password)

        assert hashed != password
        assert len(hashed) > 0

        assert verify_password(password, hashed) is True

    def test_password_hashing_wrong_password(self):
        """Тест неверного пароля при верификации"""
        password = "TestPassword123"
        wrong_password = "WrongPassword456"

        hashed = get_password_hash(password)
        assert verify_password(wrong_password, hashed) is False

    def test_different_passwords_different_hashes(self):
        """Тест что разные пароли дают разные хеши"""
        password1 = "Password123"
        password2 = "Password456"

        hash1 = get_password_hash(password1)
        hash2 = get_password_hash(password2)

        assert hash1 != hash2


class TestJWTTokenCreation:
    """Проверка создания JWT токена с корректным subject (user_id) и expiration"""

    def test_create_access_token_success(self):
        """Тест успешного создания access токена"""
        user_data = {"sub": "123e4567-e89b-12d3-a456-426614174000"}

        token = create_access_token(user_data)

        assert token is not None
        assert len(token) > 0
        assert isinstance(token, str)

    def test_create_access_token_with_custom_expiration(self):
        """Тест создания токена с кастомным временем жизни"""
        user_data = {"sub": "123e4567-e89b-12d3-a456-426614174000"}
        expires_delta = timedelta(minutes=60)

        token = create_access_token(user_data, expires_delta=expires_delta)

        assert token is not None

    def test_create_refresh_token_success(self):
        """Тест успешного создания refresh токена"""
        user_data = {"sub": "123e4567-e89b-12d3-a456-426614174000"}

        token = create_refresh_token(user_data)

        assert token is not None
        assert len(token) > 0

    def test_token_contains_subject(self):
        """Тест что токен содержит правильный subject"""
        user_id = "123e4567-e89b-12d3-a456-426614174000"
        user_data = {"sub": user_id}

        token = create_access_token(user_data)
        payload = verify_token(token, is_refresh=False)
        assert payload["sub"] == user_id


class TestJWTTokenVerification:
    """Проверка верификации JWT токена"""

    def test_verify_access_token_success(self):
        """Тест успешной верификации access токена"""
        user_data = {"sub": "123e4567-e89b-12d3-a456-426614174000"}
        token = create_access_token(user_data)

        payload = verify_token(token, is_refresh=False)

        assert payload["sub"] == user_data["sub"]
        assert payload["type"] == "access"
        assert "exp" in payload

    def test_verify_refresh_token_success(self):
        """Тест успешной верификации refresh токена"""
        user_data = {"sub": "123e4567-e89b-12d3-a456-426614174000"}
        token = create_refresh_token(user_data)

        payload = verify_token(token, is_refresh=True)

        assert payload["sub"] == user_data["sub"]
        assert payload["type"] == "refresh"

    def test_verify_wrong_token_type(self):
        """Тест верификации токена неправильного типа"""
        from jose import JWTError

        user_data = {"sub": "123e4567-e89b-12d3-a456-426614174000"}
        access_token = create_access_token(user_data)

        with pytest.raises(JWTError):
            verify_token(access_token, is_refresh=True)
