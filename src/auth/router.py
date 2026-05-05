from typing import Annotated, List
from fastapi import APIRouter, Depends, status, Query
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from src.auth.models import User
from src.core.database import get_db
from src.auth.schemas import (
    Token,
    UserCreate,
    UserUpdate,
    UserPublic,
    UserInDB,
    LoginRequest,
    RefreshTokenRequest
)
from src.auth.service import AuthService
from src.auth.dependencies import (
    CurrentUser,
    CurrentActiveUser,
    get_current_active_user,
)
from src.auth.exceptions import InvalidCredentialsException

router = APIRouter(prefix="/auth", tags=["authentication"], redirect_slashes=False)


@router.post(
    "/register",
    response_model=UserPublic,
    status_code=status.HTTP_201_CREATED
)
async def register(
        user_data: UserCreate,
        db: AsyncSession = Depends(get_db)
):
    """Регистрация нового пользователя"""
    auth_service = AuthService(db)
    user = await auth_service.create_user(user_data)
    return user


@router.post("/login", response_model=Token)
async def login(
        login_data: LoginRequest,
        db: AsyncSession = Depends(get_db)
):
    """Вход в систему"""
    auth_service = AuthService(db)

    user = await auth_service.authenticate_user(login_data)
    if not isinstance(user, User):
        raise InvalidCredentialsException()

    tokens = await auth_service.create_tokens(user)
    return tokens


@router.post("/login/form", response_model=Token)
async def login_form(
        form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
        db: AsyncSession = Depends(get_db)
):
    """Альтернативный вход через форму (для совместимости)"""
    auth_service = AuthService(db)

    login_data = LoginRequest(
        username=form_data.username,
        password=form_data.password
    )

    user = await auth_service.authenticate_user(login_data)
    if not isinstance(user, User):
        raise InvalidCredentialsException()

    tokens = await auth_service.create_tokens(user)
    return tokens


@router.post("/refresh", response_model=Token)
async def refresh_token(
        request: RefreshTokenRequest,
        db: AsyncSession = Depends(get_db)
):
    """Обновление access токена"""
    auth_service = AuthService(db)
    tokens = await auth_service.refresh_access_token(request.refresh_token)
    return tokens


@router.get("/me", response_model=UserInDB)
async def get_current_user_info(
        current_user: CurrentActiveUser
):
    """Получение информации о текущем пользователе"""
    return current_user


@router.put("/me", response_model=UserInDB)
async def update_current_user(
        update_data: UserUpdate,
        current_user: CurrentUser,
        db: AsyncSession = Depends(get_db)
):
    """Обновление данных текущего пользователя"""
    auth_service = AuthService(db)
    updated_user = await auth_service.update_user(current_user, update_data)
    return updated_user


@router.get("/users/search", response_model=List[UserPublic])
async def search_users(
        current_user: CurrentActiveUser,
        q: str = Query(..., min_length=1, max_length=50),
        limit: int = Query(10, ge=1, le=50),
        db: AsyncSession = Depends(get_db)
):
    """Поиск пользователей по username или email"""
    auth_service = AuthService(db)
    users = await auth_service.search_users(q, current_user.id, limit)
    return users
