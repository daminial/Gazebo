"""Создаем pydantic модели пользователя для валидации данных"""

from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional
from uuid import UUID
from datetime import datetime


class UserBase(BaseModel):
    """Базовая модель пользователя"""

    email: EmailStr
    username: str = Field(...)
    full_name: Optional[str] = None


class UserCreate(UserBase):
    """Модель для проверки при создании пользователя"""
    password: str  # Без min_length

    @field_validator('password')
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError('Пароль должен быть не менее 8 символов')
        if not any(c.isupper() for c in v):
            raise ValueError('Пароль должен содержать хотя бы одну большую букву')
        if not any(c.isdigit() for c in v):
            raise ValueError('Пароль должен иметь хотя бы одну цифру')
        return v


class UserUpdate(BaseModel):
    """Модель для обноваления пользователя"""
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    password: Optional[str] = Field(None, min_length=8)


class UserInDB(UserBase):
    """Модель еак будем хранить пользователя в БД"""

    id: UUID
    is_active: bool
    is_superuser: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserPublic(UserBase):
    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    """Токен доступа пользователя"""
    access_token: str
    token_type: str
    refresh_token: Optional[str] = None


class TokenPayload(BaseModel):
    sub: str
    exp: int
    type: str = "access"


class LoginRequest(BaseModel):
    """Модель входа"""
    username: str
    password: str


class RefreshTokenRequest(BaseModel):
    """Модель для обновления токена"""
    refresh_token: str
