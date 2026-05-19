from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select, or_, and_
from uuid import UUID
from datetime import datetime, timezone
import uuid as uuid_lib
import logging

from src.auth.models import User
from src.auth.schemas import UserCreate, LoginRequest, Token
from src.auth.security import (
    verify_password, get_password_hash,
    create_access_token, create_refresh_token, verify_token
)
from src.auth.emailservice import EmailService
from src.auth.exceptions import *
from src.core.storage.models import Image
from src.core.storage.s3Client import S3Client
from fastapi import UploadFile

logger = logging.getLogger(__name__)


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.email_service = EmailService()
    
    async def register_user(self, user_data: UserCreate) -> User:
        if len(user_data.username) < 3:
            raise UsernameValidationException()
        
        if await self._email_exists(user_data.email):
            raise EmailAlreadyExistsException()
        
        if await self._username_exists(user_data.username):
            raise UsernameAlreadyExistsException()
        
        verification_code = self.email_service.generate_verification_code()
        
        user = User(
            email=user_data.email,
            username=user_data.username,
            full_name=user_data.full_name,
            hashed_password=get_password_hash(user_data.password),
            email_verified=False,
            verification_code=verification_code,
            verification_code_expires=self.email_service.get_code_expiry()
        )
        
        self.db.add(user)
        await self.db.flush()
        
        await self.email_service.send_verification_email(user.email, verification_code)
        return user
    
    async def verify_email(self, email: str, code: str) -> bool:
        stmt = select(User).filter(
            User.email == email,
            User.verification_code == code,
            User.verification_code_expires > func.now()
        )
        result = await self.db.execute(stmt)
        user = result.scalar_one_or_none()
        
        if not user:
            return False
        
        user.email_verified = True
        user.verification_code = None
        user.verification_code_expires = None
        return True
    
    async def authenticate_user(self, login_data: LoginRequest) -> Optional[User]:
        stmt = select(User).filter(
            or_(
                User.email == login_data.username,
                User.username == login_data.username
            ),
            User.hashed_password.isnot(None),
            User.is_active.is_(True)
        )
        result = await self.db.execute(stmt)
        user = result.scalar_one_or_none()
        
        if not user or not verify_password(login_data.password, user.hashed_password):
            return None
        
        if not user.email_verified:
            raise EmailNotVerifiedException()
        
        return user
    
    async def delete_user_account(self, user: User) -> None:
        """Полное удаление аккаунта пользователя"""
        if user.avatar_id:
            avatar = await self.db.get(Image, user.avatar_id)
            if avatar:
                await self.db.delete(avatar)
        
        await self.db.delete(user)
        await self.db.flush()
    
    async def oauth_login(self, user_info: dict) -> User:
        user = await self._find_user_by_email_or_oauth(
            user_info["email"],
            user_info["provider"],
            user_info["provider_id"]
        )
        
        if user:
            user.full_name = user_info.get("full_name", user.full_name)
            user.oauth_provider = user_info["provider"]
            user.oauth_provider_id = user_info["provider_id"]
            user.email_verified = True
            return user
        
        username = await self._generate_unique_username(user_info["username"])
        
        user = User(
            email=user_info["email"],
            username=username,
            full_name=user_info.get("full_name"),
            email_verified=True,
            oauth_provider=user_info["provider"],
            oauth_provider_id=user_info["provider_id"]
        )
        
        self.db.add(user)
        await self.db.flush()
        return user
    
    async def create_tokens(self, user: User) -> Token:
        user_data = {"sub": str(user.id)}
        access_token = create_access_token(user_data)
        refresh_token = create_refresh_token(user_data)
        
        return Token(
            access_token=access_token,
            token_type="bearer",
            refresh_token=refresh_token
        )
    
    async def refresh_access_token(self, refresh_token: str) -> Token:
        token_data = verify_token(refresh_token, is_refresh=True)
        
        try:
            user_id = UUID(token_data["sub"])
        except (ValueError, AttributeError, TypeError):
            raise InvalidCredentialsException()
        
        user = await self.get_user_by_id(user_id)
        if not user or not user.is_active:
            raise InvalidCredentialsException()
        
        return await self.create_tokens(user)
    
    async def upload_avatar(self, user: User, file: UploadFile, s3_client: S3Client) -> User:
        if user.avatar_id:
            old_avatar = await self.db.get(Image, user.avatar_id)
            if old_avatar:
                try:
                    await s3_client.delete_file(old_avatar.storage_key)
                except Exception as e:
                    logger.warning(f"Failed to delete old avatar: {e}")
                await self.db.delete(old_avatar)
        
        today = datetime.utcnow()
        unique_id = str(uuid_lib.uuid4())[:8]
        extension = file.filename.split('.')[-1].lower()
        storage_key = f"avatars/{user.id}/{today.year}/{today.month:02d}/{unique_id}.{extension}"
        
        extra_args = {
            'ContentType': file.content_type,
            'CacheControl': 'public, max-age=31536000'
        }
        
        await s3_client.upload_fileobj(file.file, storage_key, extra_args)
        
        image = Image(
            storage_provider="s3",
            bucket=s3_client.bucket,
            storage_key=storage_key,
            filename=file.filename.rsplit('.', 1)[0],
            extension=extension,
            mime_type=file.content_type,
            file_size=file.size or 0,
            media_type="image",
            uploaded_by=user.id,
            is_public=True
        )
        
        self.db.add(image)
        await self.db.flush()
        
        user.avatar_id = image.id
        return user
    
    async def update_username(self, user: User, new_username: str) -> User:
        """Обновить имя пользователя"""
        if len(new_username) < 3:
            raise ValueError("Имя пользователя должно быть не менее 3 символов")    
        
        if new_username.strip() == user.username.strip():
            return user
        
        if await self._username_exists(new_username):
            raise ValueError("Это имя пользователя уже занято")
        
        user.username = new_username
        await self.db.flush()
        await self.db.refresh(user)  
        
        return user
    
    async def delete_avatar(self, user: User, s3_client: S3Client) -> User:
        if user.avatar_id:
            avatar = await self.db.get(Image, user.avatar_id)
            if avatar:
                try:
                    await s3_client.delete_file(avatar.storage_key)
                except Exception as e:
                    logger.warning(f"Failed to delete avatar file: {e}")
                await self.db.delete(avatar)
            
            user.avatar_id = None
        
        return user
    
    async def get_user_by_id(self, user_id: UUID) -> Optional[User]:
        stmt = select(User).filter_by(id=user_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()
    
    async def search_users(self, query: str, current_user_id: UUID, limit: int = 10) -> List[User]:
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
    
    async def _email_exists(self, email: str) -> bool:
        stmt = select(User).filter_by(email=email)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none() is not None
    
    async def _username_exists(self, username: str) -> bool:
        stmt = select(User).filter_by(username=username)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none() is not None
    
    async def _find_user_by_email_or_oauth(self, email: str, provider: str, provider_id: str) -> Optional[User]:
        stmt = select(User).filter(
            or_(
                User.email == email,
                (User.oauth_provider == provider) & (User.oauth_provider_id == provider_id)
            )
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()
    
    async def _generate_unique_username(self, base_username: str) -> str:
        username = base_username
        counter = 1
        
        while await self._username_exists(username):
            username = f"{base_username}{counter}"
            counter += 1
        
        return username