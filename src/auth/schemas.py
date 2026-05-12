"""Создаем pydantic модели пользователя для валидации данных"""

from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional
from uuid import UUID
from datetime import datetime


class UserBase(BaseModel):
    email: EmailStr
    username: str
    full_name: Optional[str] = None


class UserCreate(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=50)
    password: str
    full_name: Optional[str] = None

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
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    password: Optional[str] = Field(None, min_length=8)


class EmailVerification(BaseModel):
    email: EmailStr
    code: str


class LoginRequest(BaseModel):
    username: str
    password: str


class UserInDB(BaseModel):
    id: UUID
    email: str
    username: str
    full_name: Optional[str] = None
    avatar_id: Optional[int] = None
    email_verified: bool
    oauth_provider: Optional[str] = None
    is_active: bool
    is_superuser: bool
    role: Optional[str] = "user"
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
    
    @property
    def avatar_url(self) -> Optional[str]:
        if self.avatar_id:
            return f"/api/auth/avatar/{self.id}"
        return None


class UserPublic(BaseModel):
    id: UUID
    email: str
    username: str
    full_name: Optional[str] = None
    avatar_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True
    
    @property
    def avatar_url(self) -> Optional[str]:
        if self.avatar_id:
            return f"/api/auth/avatar/{self.id}"
        return None


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    refresh_token: Optional[str] = None


class TokenPayload(BaseModel):
    sub: str
    exp: int
    type: str = "access"


class RefreshTokenRequest(BaseModel):
    refresh_token: str
    