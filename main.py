# src/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from contextlib import asynccontextmanager

from src.core.config import settings
from src.core.exception_handlers import base_app_exception_handler, unexpected_exception_handler
from src.core.exceptions import BaseAppException
from src.core.storage.test import router as media_router
from src.auth.router import router as auth_router
from src.rooms.router import router as rooms_router
from src.map.router import router as map_router
from src.bestiary.router import router as bestiary_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"Starting {settings.PROJECT_NAME} v{settings.VERSION}")
    yield
    print("Shutting down...")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    debug=settings.DEBUG,
    lifespan=lifespan,
    swagger_ui_parameters={
        "persistAuthorization": True,
        "displayRequestDuration": True,
    }
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(BaseAppException, base_app_exception_handler)  # type: ignore
app.add_exception_handler(Exception, unexpected_exception_handler)

# Подключаем роутеры
app.include_router(media_router)
app.include_router(auth_router)
app.include_router(rooms_router)
app.include_router(map_router)
app.include_router(bestiary_router)

# Настраиваем OpenAPI схему для Swagger
def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema

    openapi_schema = get_openapi(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        routes=app.routes,
    )

    # 👇 ИСПРАВЛЕНО: Добавляем security схемы правильно
    openapi_schema["components"]["securitySchemes"] = {
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": "Введите JWT токен. Пример: eyJhbGciOiJIUzI1NiIs..."
        }
    }

    # 👇 Добавляем security ко всем эндпоинтам, кроме auth
    for path in openapi_schema["paths"]:
        for method in openapi_schema["paths"][path]:
            if not path.startswith("/auth/"):
                openapi_schema["paths"][path][method]["security"] = [{"BearerAuth": []}]

    app.openapi_schema = openapi_schema
    return app.openapi_schema


app.openapi = custom_openapi


@app.get("/")
async def root():
    return {
        "message": f"Welcome to {settings.PROJECT_NAME} API",
        "version": settings.VERSION,
        "docs": "/docs"
    }

@app.get("/health")
async def health():
    return {"status": "ok"}