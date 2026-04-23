import aioboto3
from botocore.config import Config
from typing import Optional, BinaryIO


class S3Client:
    def __init__(
            self,
            endpoint_url: str,
            access_key: str,
            secret_key: str,
            region: str = "us-east-1",
            bucket: str = "gazebo",
            public_url_base: Optional[str] = None
    ):
        self.endpoint_url = endpoint_url
        self.access_key = access_key
        self.secret_key = secret_key
        self.region = region
        self.bucket = bucket
        self.public_url_base = public_url_base
        self.session = aioboto3.Session()

        self.client_config = Config(
            retries={'max_attempts': 3, 'mode': 'adaptive'},
            connect_timeout=60,
            read_timeout=60,
            max_pool_connections=20
        )

    def _get_client_kwargs(self) -> dict:
        """Базовые параметры для подключения к S3"""
        return {
            "service_name": "s3",
            "aws_access_key_id": self.access_key,
            "aws_secret_access_key": self.secret_key,
            "endpoint_url": self.endpoint_url,
            "region_name": self.region,
            "config": self.client_config
        }

    async def upload_fileobj(
            self,
            fileobj: BinaryIO,
            storage_key: str,
            extra_args: Optional[dict] = None
    ) -> str:
        """
        Загрузка файла из file-like объекта.
        Возвращает storage_key.
        """
        async with self.session.client(**self._get_client_kwargs()) as client:
            await client.upload_fileobj(
                Bucket=self.bucket,
                Key=storage_key,
                Fileobj=fileobj,
                ExtraArgs=extra_args or {}
            )
        return storage_key

    async def download_fileobj(self, storage_key: str, fileobj: BinaryIO):
        """Скачивание файла в file-like объект."""
        async with self.session.client(**self._get_client_kwargs()) as client:
            await client.download_fileobj(
                Bucket=self.bucket,
                Key=storage_key,
                Fileobj=fileobj
            )

    async def delete_file(self, storage_key: str):
        """Удаление файла."""
        async with self.session.client(**self._get_client_kwargs()) as client:
            await client.delete_object(
                Bucket=self.bucket,
                Key=storage_key
            )

    async def get_presigned_url(
            self,
            storage_key: str,
            expires_in: int = 3600,
            method: str = 'get_object'
    ) -> str:
        """
        Генерация подписанного URL для временного доступа к файлу.
        """
        async with self.session.client(**self._get_client_kwargs()) as client:
            url = await client.generate_presigned_url(
                ClientMethod=method,
                Params={
                    'Bucket': self.bucket,
                    'Key': storage_key
                },
                ExpiresIn=expires_in
            )
            return url

    async def get_public_url(self, storage_key: str) -> Optional[str]:
        """Получение публичного URL."""
        if self.public_url_base:
            return f"{self.public_url_base.rstrip('/')}/{storage_key}"
        return None

    async def file_exists(self, storage_key: str) -> bool:
        """Проверка существования файла."""
        try:
            async with self.session.client(**self._get_client_kwargs()) as client:
                await client.head_object(Bucket=self.bucket, Key=storage_key)
                return True
        except:
            return False
