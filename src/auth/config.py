"""Файл конфигурации """

from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

class AuthSettings(BaseSettings):
    PROJECT_ROOT: Path = Path(__file__).parent.parent.parent

    JWT_SECRET_KEY: str
    JWT_REFRESH_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    PASSWORD_HASH_ALGORITHM: str = "argon2"

    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env",
        env_prefix="AUTH_",
        env_file_encoding="utf-8",
        extra="ignore"
    )

auth_settings = AuthSettings()