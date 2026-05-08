from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from uuid import UUID

from src.auth.exceptions import EmailAlreadyExistsException, UsernameAlreadyExistsException, InvalidCredentialsException, UsernameValidationException
from src.auth.models import User
from src.auth.schemas import UserCreate, UserUpdate, Token, LoginRequest
from src.auth.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    verify_token
)


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def authenticate_user(self, login_data: LoginRequest) -> Optional[User]:
        """Аутентификация пользователя по email/username и паролю"""
        stmt = select(User).filter(
            or_(
                User.email == login_data.username,
                User.username == login_data.username
            ),
            User.is_active.is_(True)
        )

        result = await self.db.execute(stmt)
        user = result.scalar_one_or_none()

        if not isinstance(user, User):
            return None

        if not verify_password(login_data.password, user.hashed_password):
            return None

        return user

    async def create_user(self, user_data: UserCreate) -> User:
        """Создание нового пользователя"""
        
        if len(user_data.username) < 3:
            raise UsernameValidationException("Имя пользователя должно быть не менее 3 символов")
        
        if len(user_data.username) > 50:
            raise UsernameValidationException("Имя пользователя не должно превышать 50 символов")

        email_exists = await self.db.execute(
            select(User).filter_by(email=user_data.email)
        )
        if email_exists.scalar_one_or_none():
            raise EmailAlreadyExistsException()

        username_exists = await self.db.execute(
            select(User).filter_by(username=user_data.username)
        )
        if username_exists.scalar_one_or_none():
            raise UsernameAlreadyExistsException()

        hashed_password = get_password_hash(user_data.password)
        user = User(
            email=user_data.email,
            username=user_data.username,
            full_name=user_data.full_name,
            hashed_password=hashed_password
        )

        self.db.add(user)
        await self.db.flush()
        return user

    async def get_user_by_id(self, user_id: UUID) -> Optional[User]:
        """Получение пользователя по ID"""
        stmt = select(User).filter_by(id=user_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_user_by_email(self, email: str) -> Optional[User]:
        """Получение пользователя по email"""
        stmt = select(User).filter_by(email=email)
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

        try:
            user_id = UUID(token_data.sub)
        except (ValueError, AttributeError, TypeError):
            raise InvalidCredentialsException()

        user = await self.get_user_by_id(user_id)
        if not user or not user.is_active:
            raise InvalidCredentialsException()

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

        return user

    async def search_users(self, query: str, current_user_id: UUID, limit: int = 10) -> list[User]:
        """Поиск пользователей по username или email"""
        from sqlalchemy import or_, and_
        
        stmt = select(User).where(
            and_(
                User.id != current_user_id,
                or_(
                    User.username.ilike(f"%{query}%"),
                    User.email.ilike(f"%{query}%")
                )
            )
        ).limit(limit)
        
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
