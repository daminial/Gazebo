from typing import List, Optional
from fastapi import APIRouter, Body, Depends, status, HTTPException, UploadFile, File
from fastapi.responses import RedirectResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi.responses import HTMLResponse
import io
import logging

from src.core.config import settings
from src.core.database import get_db
from src.core.storage.s3Client import S3Client
from src.core.storage.dependencies import get_s3_client
from src.core.storage.models import Image
from src.auth.models import User
from src.auth.schemas import (
    UserCreate, LoginRequest, Token, UserInDB, UserPublic,
    EmailVerification, RefreshTokenRequest
)
from src.auth.service import AuthService
from src.auth.oauth_providers import GitHubProvider, GoogleProvider, VKProvider
from src.auth.dependencies import (
    CurrentActiveUser, CurrentModerator, CurrentSuperuser, get_current_user
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["authentication"])


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db)
):
    auth_service = AuthService(db)
    user = await auth_service.register_user(user_data)
    return {
        "message": "Код подтверждения отправлен на email",
        "email": user.email
    }


@router.post("/verify-email")
async def verify_email(
    verification: EmailVerification,
    db: AsyncSession = Depends(get_db)
):
    auth_service = AuthService(db)
    verified = await auth_service.verify_email(verification.email, verification.code)
    
    if not verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный или просроченный код"
        )
    
    return {"message": "Email успешно подтвержден"}


@router.post("/login", response_model=Token)
async def login(
    login_data: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    auth_service = AuthService(db)
    user = await auth_service.authenticate_user(login_data)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный логин или пароль"
        )
    
    return await auth_service.create_tokens(user)


@router.get("/login/{provider}")
async def oauth_login(provider: str):
    providers = {
        "github": GitHubProvider(),
        "google": GoogleProvider(),
        "vk": VKProvider()
    }
    
    if provider not in providers:
        raise HTTPException(status_code=404, detail="Провайдер не найден")
    
    try:
        auth_url = await providers[provider].get_authorization_url()
        return RedirectResponse(url=auth_url)
    except Exception as e:
        logger.error(f"OAuth error: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"OAuth провайдер не настроен: {provider}"
        )


@router.get("/callback/{provider}")
async def oauth_callback(
    provider: str,
    code: str,
    error: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    if error:
        return HTMLResponse(
            content=f"""
            <script>
                localStorage.setItem('oauth_error', '{error}');
                window.close();
            </script>
            """,
            status_code=400
        )
    
    providers = {
        "github": GitHubProvider(),
        "google": GoogleProvider(),
        "vk": VKProvider()
    }
    
    if provider not in providers:
        raise HTTPException(status_code=404, detail="Провайдер не найден")
    
    try:
        user_info = await providers[provider].get_user_info(code)
    except Exception as e:
        logger.error(f"OAuth callback error: {e}")
        return HTMLResponse(
            content=f"""
            <script>
                localStorage.setItem('oauth_error', '{str(e)}');
                window.close();
            </script>
            """
        )
    
    auth_service = AuthService(db)
    user = await auth_service.oauth_login(user_info)
    tokens = await auth_service.create_tokens(user)
    
    frontend_url = settings.FRONTEND_URL
    
    return HTMLResponse(
        content=f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Вход через {provider.title()}</title>
            <style>
                body {{
                    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                    background: #FEF3DF;
                    color: #5A4A3A;
                }}
                .loader {{
                    text-align: center;
                }}
                .spinner {{
                    width: 40px;
                    height: 40px;
                    border: 4px solid #E3B46A;
                    border-top: 4px solid #BC6C25;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin: 0 auto 16px;
                }}
                @keyframes spin {{
                    0% {{ transform: rotate(0deg); }}
                    100% {{ transform: rotate(360deg); }}
                }}
            </style>
        </head>
        <body>
            <div class="loader">
                <div class="spinner"></div>
                <p>Входим в аккаунт...</p>
            </div>
            <script>
                window.location.href = 'http://localhost/?access_token={tokens.access_token}&refresh_token={tokens.refresh_token}';
            </script>
        </body>
        </html>
        """
    )

@router.delete("/account")
async def delete_account(
    current_user: CurrentActiveUser,
    db: AsyncSession = Depends(get_db)
):
    """Удаление своего аккаунта"""
    auth_service = AuthService(db)
    await auth_service.delete_user_account(current_user)
    return {"message": "Аккаунт успешно удален"}


@router.post("/refresh", response_model=Token)
async def refresh_token(
    request: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db)
):
    auth_service = AuthService(db)
    return await auth_service.refresh_access_token(request.refresh_token)


@router.get("/me", response_model=UserInDB)
async def get_current_user_info(current_user: CurrentActiveUser):
    return current_user


@router.get("/users/search", response_model=List[UserPublic])
async def search_users(
    q: str,
    current_user: CurrentActiveUser,
    limit: int = 10,
    db: AsyncSession = Depends(get_db)
):
    auth_service = AuthService(db)
    return await auth_service.search_users(q, current_user.id, limit)


@router.post("/avatar", response_model=UserInDB)
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: CurrentActiveUser = None, 
    db: AsyncSession = Depends(get_db),
    s3_client: S3Client = Depends(get_s3_client)
):
    if not file.content_type or not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="Только изображения разрешены")
    
    if file.size and file.size > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Файл слишком большой. Максимум 5MB")
    
    auth_service = AuthService(db)
    user = await auth_service.upload_avatar(current_user, file, s3_client)
    return user

@router.patch("/username", response_model=UserInDB)
async def update_username(
    current_user: CurrentActiveUser,
    username: str = Body(..., embed=True),
    db: AsyncSession = Depends(get_db)
):
    """Обновить имя пользователя"""
    
    if len(username) < 3:
        raise HTTPException(status_code=400, detail="Имя пользователя должно быть не менее 3 символов")
    
    auth_service = AuthService(db)
    
    try:
        user = await auth_service.update_username(current_user, username)
        return user
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/avatar")
async def remove_avatar(
    current_user: CurrentActiveUser = None, 
    db: AsyncSession = Depends(get_db),
    s3_client: S3Client = Depends(get_s3_client)
):
    auth_service = AuthService(db)
    await auth_service.delete_avatar(current_user, s3_client)
    return {"message": "Аватар удален"}


@router.get("/avatar/{user_id}")
async def get_user_avatar(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    s3_client: S3Client = Depends(get_s3_client)
):
    from uuid import UUID
    
    try:
        uid = UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Неверный ID пользователя")
    
    user = await db.get(User, uid)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    if user.avatar_id:
        image = await db.get(Image, user.avatar_id)
        if image and image.storage_key:
            try:
                file_buffer = io.BytesIO()
                await s3_client.download_fileobj(image.storage_key, file_buffer)
                file_buffer.seek(0)
                return StreamingResponse(
                    file_buffer,
                    media_type=image.mime_type or "image/jpeg",
                    headers={"Cache-Control": "public, max-age=31536000"}
                )
            except Exception as e:
                logger.error(f"Error loading avatar: {e}")
    
    raise HTTPException(status_code=404, detail="Аватар не найден")


@router.put("/users/{user_id}/role")
async def set_user_role(
    user_id: str,
    role: str,
    current_user: CurrentSuperuser,
    db: AsyncSession = Depends(get_db)
):
    from uuid import UUID
    
    try:
        uid = UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Неверный ID пользователя")
    
    if role not in ["user", "moderator", "admin"]:
        raise HTTPException(status_code=400, detail="Неверная роль")
    
    user = await db.get(User, uid)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    user.role = role
    await db.flush()
    
    return {"message": f"Роль пользователя изменена на {role}"}
