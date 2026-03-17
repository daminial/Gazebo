from sqlalchemy import select
from sqlalchemy.orm import selectinload

from src.core.storage.s3Client import S3Client
from src.core.storage.models import MediaFile, Image, Audio
from src.core.storage.schemas import (
    MediaFileCreate, ImageCreate, AudioCreate,
    MediaFileResponse, ImageResponse, AudioResponse,
    MediaType
)
from uuid import UUID
from typing import BinaryIO, Union


class MediaService:
    def __init__(self, s3_client: S3Client, db_session):
        self.s3 = s3_client
        self.db = db_session

    async def upload_file(
            self,
            file: BinaryIO,
            file_data: Union[MediaFileCreate, ImageCreate, AudioCreate],
            user_id: UUID
    ) -> Union[MediaFileResponse, ImageResponse, AudioResponse]:
        """Загрузка файла в S3 и создание записи в БД."""

        if file_data.file_size > 100 * 1024 * 1024:
            raise ValueError("Файл слишком большой")

        storage_key = self._generate_storage_key(file_data, user_id)

        extra_args = {
            'ContentType': file_data.mime_type,
            'CacheControl': 'public, max-age=31536000'
        }

        await self.s3.upload_fileobj(file, storage_key, extra_args)
        model_data = file_data.model_dump(exclude={'type'})

        if file_data.type == MediaType.IMAGE:
            db_file = Image(
                storage_provider="s3",
                bucket=self.s3.bucket,
                storage_key=storage_key,
                **model_data
            )
        elif file_data.type == MediaType.AUDIO:
            db_file = Audio(
                storage_provider="s3",
                bucket=self.s3.bucket,
                storage_key=storage_key,
                **model_data
            )
        else:
            db_file = MediaFile(
                storage_provider="s3",
                bucket=self.s3.bucket,
                storage_key=storage_key,
                **model_data
            )

        self.db.add(db_file)
        await self.db.commit()
        await self.db.refresh(db_file)

        if file_data.type == MediaType.IMAGE:
            stmt = select(Image).where(Image.id == db_file.id).options(selectinload(Image.thumbnail))
            result = await self.db.execute(stmt)
            db_file = result.scalar_one()

        response_class = {
            MediaType.IMAGE: ImageResponse,
            MediaType.AUDIO: AudioResponse,
            MediaType.MEDIA_FILE: MediaFileResponse
        }.get(file_data.type, MediaFileResponse)

        response = response_class.model_validate(db_file)
        response.download_url = await self.s3.get_presigned_url(storage_key)
        response.public_url = await self.s3.get_public_url(storage_key)

        return response

    def _generate_storage_key(self, file_data: Union[MediaFileCreate, ImageCreate, AudioCreate], user_id: UUID) -> str:
        """Генерация уникального пути в S3."""
        from datetime import datetime
        import uuid

        today = datetime.utcnow()
        file_type = file_data.type.value

        clean_filename = "".join(c for c in file_data.filename if c.isalnum() or c in '._- ').strip()

        unique_id = str(uuid.uuid4())[:8]

        return f"{file_type}s/{today.year}/{today.month:02d}/{today.day:02d}/{user_id}_{clean_filename}_{unique_id}.{file_data.extension}"
