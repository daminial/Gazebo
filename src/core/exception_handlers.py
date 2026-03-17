import logging
from fastapi import Request
from fastapi.responses import JSONResponse

from src.core.exceptions import BaseAppException

logger = logging.getLogger(__name__)

async def base_app_exception_handler(request: Request, exc: BaseAppException) -> JSONResponse:
    """Обработчик для кастомных исключений приложения"""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.detail,
            "error_code": exc.__class__.__name__
        }
    )

async def unexpected_exception_handler(request: Request, exc: Exception):
    """Обработчик для всех неожиданных ошибок"""
    logger.error(
        f"Unexpected error: {exc}",
        exc_info=True,
        extra={
            "path": request.url.path,
            "method": request.method
        }
    )

    return JSONResponse(
        status_code=500,
        content={
            "detail": "Внутренняя ошибка сервера",
            "error_code": "InternalServerError"
        }
    )
