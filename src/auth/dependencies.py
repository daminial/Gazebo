from typing import Optional, Annotated
from fastapi import Depends, status
from fastapi.security import OAuth2PasswordBearer, HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from jose import JWTError

from src.core.database import get_db
from src.auth.models import User
from src.auth.security import verify_token
from src.auth.service import AuthService
from src.auth.exceptions import AuthException

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/auth/login",
    auto_error=False,
)

bearer_scheme = HTTPBearer(
    auto_error=False,
    description="JWT токен авторизации. Получите через /auth/login"
)


async def get_current_user(
        token: Optional[str] = Depends(oauth2_scheme),
        credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
        db: AsyncSession = Depends(get_db)
) -> User:
    """Зависимость для получения текущего пользователя"""

    if not token and credentials:
        token = credentials.credentials

    if not token:
        raise AuthException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        token_data = verify_token(token)
    except JWTError:
        raise AuthException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    auth_service = AuthService(db)
    user = await auth_service.get_user_by_id(token_data.sub)

    if not user:
        raise AuthException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


async def get_current_active_user(
        current_user: User = Depends(get_current_user)
) -> User:
    """Зависимость для проверки активности пользователя"""
    if not current_user.is_active:
        raise AuthException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    return current_user


async def get_current_superuser(
        current_user: User = Depends(get_current_active_user)
) -> User:
    """Зависимость для проверки прав администратора"""
    if not current_user.is_superuser:
        raise AuthException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user


CurrentUser = Annotated[User, Depends(get_current_user)]
CurrentActiveUser = Annotated[User, Depends(get_current_active_user)]
CurrentSuperuser = Annotated[User, Depends(get_current_superuser)]
