from functools import lru_cache
from src.core.config import settings
from src.core.storage.s3Client import S3Client

@lru_cache
def get_s3_client() -> S3Client:
    """Возвращает настроенный экземпляр S3Client"""
    return S3Client(
        endpoint_url=settings.S3_ENDPOINT_URL,
        access_key=settings.S3_ACCESS_KEY,
        secret_key=settings.S3_SECRET_KEY,
        bucket=settings.S3_BUCKET_NAME,
        public_url_base=settings.S3_PUBLIC_URL,
    )
