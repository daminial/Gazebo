from typing import Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from datetime import timedelta
from fastapi import HTTPException, status

from src.auth.models import User
from src.auth.schemas import UserCreate, UserUpdate, Token, LoginRequest
from src.auth.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    verify_token
)
from src.core.config import Settings


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def authenticate_user(self, login_data: LoginRequest) -> Optional[User]:
        """Аутентификация пользователя по email/username и паролю"""
        # Ищем по email
        stmt = select(User).filter(
            (User.email == login_data.username) |
            (User.username == login_data.username),
            User.is_active == True
        )

        result = await self.db.execute(stmt)
        user = result.scalar_one_or_none()

        if not user:
            return None

        if not verify_password(login_data.password, user.hashed_password):
            return None

        return user

    async def create_user(self, user_data: UserCreate) -> User:
        """Создание нового пользователя"""
        # Проверяем, не существует ли уже пользователь
        stmt = select(User).where(
            (User.email == user_data.email) |
            (User.username == user_data.username)
        )
        result = await self.db.execute(stmt)
        existing_user = result.scalar_one_or_none()

        if existing_user:
            if existing_user.email == user_data.email:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email already registered"
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Username already taken"
                )

        hashed_password = get_password_hash(user_data.password)

        user = User(
            email=user_data.email,
            username=user_data.username,
            full_name=user_data.full_name,
            hashed_password=hashed_password
        )

        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)

        return user

    async def get_user_by_id(self, user_id: UUID) -> Optional[User]:
        """Получение пользователя по ID"""
        stmt = select(User).where(User.id == user_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_user_by_email(self, email: str) -> Optional[User]:
        """Получение пользователя по email"""
        stmt = select(User).where(User.email == email)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def create_tokens(self, user: User) -> Token:
        """Создание access и refresh токенов"""
        user_data = {"sub": str(user.id)}

        access_token = create_access_token(user_data)
        refresh_token = create_refresh_token(user_data)

        return Token(
            access_token=access_token,
            token_type="bearer",
            refresh_token=refresh_token
        )

    async def refresh_access_token(self, refresh_token: str) -> Token:
        """Обновление access токена"""
        token_data = verify_token(refresh_token, is_refresh=True)

        # Получаем пользователя
        user = await self.get_user_by_id(UUID(token_data.sub))
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired refresh token"
            )

        return await self.create_tokens(user)

    async def update_user(
            self,
            user: User,
            update_data: UserUpdate
    ) -> User:
        """Обновление данных пользователя"""
        update_dict = update_data.model_dump(exclude_unset=True)

        if "password" in update_dict:
            update_dict["hashed_password"] = get_password_hash(
                update_dict.pop("password")
            )

        for field, value in update_dict.items():
            setattr(user, field, value)

        await self.db.commit()
        await self.db.refresh(user)

        return user
