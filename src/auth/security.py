from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from jose import JWTError, jwt
from passlib.context import CryptContext
from src.core.config import settings
from src.auth.schemas import TokenPayload

pwd_context = CryptContext(
    schemes=[settings.PASSWORD_HASH_ALGORITHM],
    deprecated="auto"
)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Проверка пароля"""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Хэширование пароля"""
    return pwd_context.hash(password)


def create_access_token(
        data: Dict[str, Any],
        expires_delta: Optional[timedelta] = None
) -> str:
    """Создание access токена"""
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )

    to_encode.update({
        "exp": expire,
        "type": "access"
    })

    encoded_jwt = jwt.encode(
        to_encode,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM
    )
    return encoded_jwt


def create_refresh_token(
        data: Dict[str, Any],
        expires_delta: Optional[timedelta] = None
) -> str:
    """Создание refresh токена"""
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            days=settings.REFRESH_TOKEN_EXPIRE_DAYS
        )

    to_encode.update({
        "exp": expire,
        "type": "refresh"
    })

    encoded_jwt = jwt.encode(
        to_encode,
        settings.JWT_REFRESH_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM
    )
    return encoded_jwt


def verify_token(token: str, is_refresh: bool = False) -> TokenPayload:
    """Верификация токена"""
    try:
        secret_key = (
            settings.JWT_REFRESH_SECRET_KEY
            if is_refresh
            else settings.JWT_SECRET_KEY
        )

        payload = jwt.decode(
            token,
            secret_key,
            algorithms=[settings.JWT_ALGORITHM]
        )

        token_type = payload.get("type")
        if is_refresh and token_type != "refresh":
            raise JWTError("Invalid token type")
        elif not is_refresh and token_type != "access":
            raise JWTError("Invalid token type")

        return TokenPayload(
            sub=payload.get("sub"),
            exp=payload.get("exp"),
            type=payload.get("type", "access")
        )

    except JWTError:
        raise
