from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from fastapi.responses import StreamingResponse, RedirectResponse
from .service import MediaService
from .schemas import ImageCreate, MediaFileResponse
from src.auth.dependencies import CurrentActiveUser, get_current_user
from sqlalchemy.ext.asyncio import AsyncSession
from src.core.database import get_db
from src.core.config import settings
from src.core.storage.s3Client import S3Client
from ...auth.models import User
from sqlalchemy import select
from src.core.storage.models import Image
import httpx

router = APIRouter(prefix="/media", tags=["media"])


async def get_media_service(
        db: AsyncSession = Depends(get_db)
) -> MediaService:
    """Зависимость для получения MediaService"""
    s3 = S3Client(
        endpoint_url=settings.S3_ENDPOINT_URL,
        access_key=settings.S3_ACCESS_KEY,
        secret_key=settings.S3_SECRET_KEY,
        bucket=settings.S3_BUCKET_NAME,
        public_url_base=settings.S3_PUBLIC_URL
    )
    return MediaService(s3, db)


@router.get("/{image_id}")
async def get_image(
        image_id: int,
        db: AsyncSession = Depends(get_db)
):
    """Проксирование изображения из S3"""
    import logging
    logger = logging.getLogger(__name__)
    
    stmt = select(Image).where(Image.id == image_id)
    result = await db.execute(stmt)
    image = result.scalar_one_or_none()
    
    logger.info(f"Запрос изображения ID={image_id}, найдено: {image is not None}")
    
    if not image:
        logger.warning(f"Изображение {image_id} не найдено в БД")
        raise HTTPException(404, "Изображение не найдено")
    
    logger.info(f"Storage key: {image.storage_key}, Bucket: {image.bucket}")
    
    if not image.storage_key:
        logger.warning(f"У изображения {image_id} нет storage_key")
        raise HTTPException(404, "Изображение не найдено")
    
    s3 = S3Client(
        endpoint_url=settings.S3_ENDPOINT_URL,
        access_key=settings.S3_ACCESS_KEY,
        secret_key=settings.S3_SECRET_KEY,
        bucket=settings.S3_BUCKET_NAME,
        public_url_base=settings.S3_PUBLIC_URL
    )
    
    import io
    file_buffer = io.BytesIO()
    
    try:
        logger.info(f"Загрузка файла из S3: {image.storage_key}")
        await s3.download_fileobj(image.storage_key, file_buffer)
        logger.info(f"Файл загружен, размер: {len(file_buffer.getvalue())} байт")
    except Exception as e:
        logger.error(f"Ошибка загрузки из S3: {e}")
        raise HTTPException(404, f"Изображение не найдено в хранилище: {e}")
    
    file_buffer.seek(0)
    
    return StreamingResponse(
        file_buffer,
        media_type=image.mime_type,
        headers={
            "Cache-Control": "public, max-age=31536000"
        }
    )

@router.get("/audio/{audio_id}")
async def get_audio(
        audio_id: int,
        db: AsyncSession = Depends(get_db)
):
    """Проксирование аудиофайла из S3"""
    import logging
    logger = logging.getLogger(__name__)
    
    from src.core.storage.models import Audio
    
    stmt = select(Audio).where(Audio.id == audio_id)
    result = await db.execute(stmt)
    audio = result.scalar_one_or_none()
    
    if not audio:
        raise HTTPException(404, "Аудиофайл не найден")
    
    if not audio.storage_key:
        raise HTTPException(404, "Аудиофайл не найден в хранилище")
    
    s3 = S3Client(
        endpoint_url=settings.S3_ENDPOINT_URL,
        access_key=settings.S3_ACCESS_KEY,
        secret_key=settings.S3_SECRET_KEY,
        bucket=settings.S3_BUCKET_NAME,
        public_url_base=settings.S3_PUBLIC_URL
    )
    
    import io
    file_buffer = io.BytesIO()
    
    try:
        await s3.download_fileobj(audio.storage_key, file_buffer)
    except Exception as e:
        raise HTTPException(404, f"Файл не найден в хранилище: {e}")
    
    file_buffer.seek(0)
    
    return StreamingResponse(
        file_buffer,
        media_type=audio.mime_type,
        headers={
            "Cache-Control": "public, max-age=31536000",
            "Accept-Ranges": "bytes",
        }
    )


@router.post("/upload/image", response_model=MediaFileResponse)
async def upload_image(
        file: UploadFile = File(...),
        service: MediaService = Depends(get_media_service),
        current_user: User = Depends(get_current_user)
):
    if not file.content_type.startswith('image/'):
        raise HTTPException(400, "Only images allowed")

    image_data = ImageCreate(
        filename=file.filename.rsplit('.', 1)[0],
        extension=file.filename.split('.')[-1],
        mime_type=file.content_type,
        file_size=file.size or 0,
        uploaded_by=current_user.id,
        is_public=True
    )

    result = await service.upload_file(file.file, image_data, user_id=current_user.id)
    return result
